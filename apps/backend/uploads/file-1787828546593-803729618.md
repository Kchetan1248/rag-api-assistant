# Telephony CRM API Documentation

## Overview
The Telephony CRM API allows you to manage teams, supervisors, and call routing logic for your customer support center. The base URL for all endpoints is `https://api.telephony-crm.com/v1`.

## Authentication
To authenticate, you must pass a Bearer token in the Authorization header of your HTTP request. 
Example: `Authorization: Bearer <your_api_key>`
API Keys can be generated in the Supervisor Dashboard under "Security Settings".

## Endpoints

### 1. Get Team Status
**Endpoint:** `GET /teams/{team_id}/status`
**Description:** Retrieves the real-time status of all agents in a specific team.
**Response:**
Returns a JSON array of agents with their current state: `Available`, `On Call`, or `Offline`.
If the `team_id` is invalid, the system returns a `404 Not Found` error.

### 2. Route Incoming Call
**Endpoint:** `POST /calls/route`
**Description:** Dynamically routes an incoming call to the next available agent based on skill-based routing rules.
**Request Body:**
```json
{
  "caller_id": "+15551234567",
  "department": "sales",
  "priority": "high"
}
```
**Response:**
Returns a `200 OK` with the assigned `agent_id` and the estimated wait time in seconds.

## Rate Limiting
The API is strictly rate-limited to 100 requests per minute per IP address. If you exceed this limit, the server will respond with a `429 Too Many Requests` status code. You can find your current rate limit usage in the `X-RateLimit-Remaining` header of any API response.
