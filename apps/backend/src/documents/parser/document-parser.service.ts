import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import { extname } from 'path';
import * as yaml from 'yaml';
const pdfParse = require('pdf-parse');

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  /**
   * Reads a file from disk and extracts its raw text content.
   */
  async parseFile(filePath: string): Promise<string> {
    this.logger.log(`Parsing file: ${filePath}`);
    const extension = extname(filePath).toLowerCase();

    try {
      const fileBuffer = await fs.readFile(filePath);

      switch (extension) {
        case '.json':
          return this.parseJson(fileBuffer.toString('utf-8'));
        case '.yaml':
        case '.yml':
          return this.parseYaml(fileBuffer.toString('utf-8'));
        case '.md':
        case '.txt':
          return fileBuffer.toString('utf-8'); // Markdown and TXT are already raw text
        case '.pdf':
          return this.parsePdf(fileBuffer);
        default:
          throw new BadRequestException(`Unsupported file extension: ${extension}`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  private parseJson(content: string): string {
    // We validate it's valid JSON, then return a stringified version 
    // that is easier for the LLM to read (removing extra whitespace if needed)
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  }

  private parseYaml(content: string): string {
    // Validate YAML and convert it back to a clean string
    const parsed = yaml.parse(content);
    return yaml.stringify(parsed);
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
  }
}
