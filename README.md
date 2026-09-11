# SalesAI Hub

Build DigiCRM AI – Enterprise AI-Powered Sales CRM

Build a production-ready multi-tenant SaaS CRM called DigiCRM AI.

The application should look like a modern SaaS product similar to HubSpot, Salesforce and Attio with a clean UI, responsive layout, dark/light mode, professional charts, animations and enterprise-level UX.

The application must be fully functional with complete CRUD operations, Supabase integration, authentication, role-based permissions, OpenAI integration, realtime updates and proper validations.

Tech Stack

Use

Lovable

React

TypeScript

TailwindCSS

shadcn/ui

Supabase

PostgreSQL

Supabase Auth

Supabase Storage

Supabase Edge Functions

OpenAI API

Recharts

React Hook Form

Zod Validation

Authentication

Create complete authentication.

Features

Login

Signup

Forgot Password

Reset Password

Email Verification

Google Login

Session Management

Remember Me

Secure Logout

Password Strength Meter

Roles

Super Admin

Admin

Sales Manager

Sales Executive

Each role must have separate permissions.

Admin controls everything.

Sales Manager can manage team.

Sales Executive only manages assigned leads.

Unauthorized users cannot access restricted pages.

Sidebar

Dashboard

Leads

Contacts

Companies

Tasks

Calendar

Meetings

Pipeline

Reports

AI Assistant

Proposal Generator

Automation

Notifications

Settings

Profile

Logout

Dashboard

Professional dashboard with cards.

Display

Total Leads

Qualified Leads

Open Deals

Won Deals

Lost Deals

Revenue

Monthly Revenue

Sales Funnel

Pipeline Value

Average Deal Size

Conversion Rate

Tasks Due Today

Upcoming Meetings

Recent Activities

Top Performing Salesperson

Lead Source Distribution

Recent Notifications

Show charts

Bar Chart

Line Chart

Pie Chart

Area Chart

Realtime updates using Supabase.

Leads Module

Create complete Lead Management.

Fields

Lead ID

Company Name

Contact Person

Designation

Email

Phone

Alternate Phone

Website

Industry

Country

State

City

Address

Lead Source

Campaign

Status

Priority

Estimated Deal Value

Expected Closing Date

Assigned Salesperson

Tags

Notes

Documents

Created By

Created Date

Updated Date

Functions

Create Lead

View Lead

Update Lead

Delete Lead

Bulk Delete

Bulk Import CSV

Bulk Export CSV

Duplicate Lead

Lead Timeline

Activity Log

Lead History

Search

Advanced Filters

Sorting

Pagination

Save Filters

Lead Merge

Archive Lead

Restore Lead

Soft Delete

Validation

Email Validation

Phone Validation

Required Fields

Duplicate Email Detection

Duplicate Phone Detection

Show success and error messages.

Contacts Module

CRUD

Import

Export

Notes

Activity History

Associated Company

Associated Deals

Tasks

Files

Profile Picture

Communication History

Companies Module

CRUD

Company Profile

Industry

Revenue

Employee Count

GST Number

Website

Address

Contacts

Deals

Notes

Files

Timeline

Pipeline

Create Kanban Pipeline.

Stages

New

Contacted

Qualified

Proposal Sent

Negotiation

Won

Lost

Drag and Drop

Realtime updates

Pipeline Analytics

Probability Percentage

Expected Revenue

Tasks

CRUD

Task Title

Description

Priority

Due Date

Reminder

Assign User

Status

Attachments

Recurring Tasks

Task Comments

Task History

Calendar Integration

Meetings

Schedule Meetings

Calendar View

Google Calendar Ready

Meeting Notes

Participants

Reminder

Meeting Summary

Recording Link

Status

Attachments

Calendar

Month View

Week View

Day View

Tasks

Meetings

Reminders

Drag Events

Realtime

AI Sales Assistant

Integrate OpenAI.

User can ask

Summarize customer

Generate Follow-up Email

Generate WhatsApp Message

Generate Sales Pitch

Generate Proposal

Generate Quotation

Generate Agreement

Generate Cold Email

Generate LinkedIn Message

Predict Closing Probability

Customer Sentiment

Risk Analysis

Best Time To Follow Up

Lead Qualification Score

Next Best Action

Sales Forecast

Meeting Summary

Call Summary

Email Summary

Proposal Improvement

Lead Insights

Display AI response in chat format.

Allow copy.

Allow regenerate.

Save conversation.

Proposal Generator

Generate

Proposal

Quotation

Agreement

Invoice Draft

Partnership Proposal

Sales Pitch

Email Draft

Editable Rich Text Editor

Export PDF

Export DOCX

Share Link

Company Branding

Logo

Signature

Watermark

Reports

Revenue

Lead Source

Pipeline

Salesperson

Conversion

Activity

Lost Deals

Won Deals

Monthly

Quarterly

Yearly

Export PDF

Export Excel

Download CSV

Print

Automation Module

Workflow Builder

Example

When Lead Created

↓

Assign Salesperson

↓

Create Follow-up Task

↓

Generate AI Welcome Email

↓

Notify Sales Manager

↓

Send WhatsApp

↓

Update Dashboard

Create visual automation builder.

Notifications

Browser Notifications

Email Notifications

In-App Notifications

Daily Summary

Task Reminder

Meeting Reminder

Lead Assignment

Deal Won

Deal Lost

Unread Counter

Notification History

Files

Supabase Storage

Upload Documents

PDF

DOC

Excel

Images

ZIP

Preview

Download

Delete

Version History

Activity Timeline

Every action must be recorded.

Lead Created

Lead Updated

Lead Deleted

Task Assigned

Meeting Scheduled

Proposal Generated

AI Generated Email

Login

Logout

Password Changed

Exported Report

Show timestamp and user.

Settings

Company Profile

Logo

Brand Color

Currency

Timezone

Email Templates

Notification Settings

User Management

Role Management

Custom Fields

Lead Status

Lead Source

API Keys

Integrations

Backup

User Management

CRUD

Invite User

Deactivate User

Reset Password

Assign Role

Permissions

Activity

Login History

Database

Create complete normalized PostgreSQL schema.

Tables

users

roles

permissions

companies

contacts

leads

lead_notes

lead_files

activities

tasks

meetings

notifications

proposals

automation_rules

settings

email_templates

custom_fields

pipeline_stage

lead_tags

deal_history

Indexes

Foreign Keys

Constraints

Cascade Delete where appropriate

Soft Delete support

Created_at

Updated_at

Created_by

Updated_by

CRUD Requirements

Every module must support

Create

Read

Update

Delete

Bulk Delete

Bulk Update

Import

Export

Pagination

Search

Sorting

Advanced Filters

Validation

Confirmation before Delete

Undo Delete

Soft Delete

Restore

Loading State

Skeleton Loader

Toast Messages

Success Alerts

Error Handling

Empty States

No Data Illustration

Permission Checks

Audit Log

Search

Global Search

Search Leads

Contacts

Companies

Tasks

Meetings

Proposals

Users

Recent Searches

Security

Supabase Authentication

Row Level Security

Protected Routes

Role Based Access

SQL Injection Protection

Input Validation

Secure API Calls

Rate Limiting Ready

Responsive

Desktop

Tablet

Mobile

Professional UI

Animations

Dark Mode

Accessibility

Keyboard Navigation

Sample Data

Generate realistic demo data

500 Leads

200 Contacts

100 Companies

30 Users

200 Tasks

100 Meetings

Revenue Analytics

Charts

Pipeline Data

Activities

Testing Checklist

Before considering the application complete, verify every feature works correctly.

Authentication flows (signup, login, logout, password reset, Google login)

Role-based access restrictions for all user roles

CRUD operations for every module

CSV import/export

Search, filters, sorting, and pagination

File uploads and downloads

AI assistant prompts and responses

Proposal generation and export

Dashboard metrics and charts

Notifications

Realtime updates

Calendar interactions

Workflow automation

Reports generation

Validation messages

Mobile responsiveness

Error states and empty states

Loading indicators

Audit logs

Database relationships

Security rules

Performance and UI consistency

The application should be production-ready, visually polished, scalable, and suitable for demonstrating enterprise SaaS development capabilities in the Lovable Solution Partner certification.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://digicrm-ai-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bde2e929-0783-4c23-95b6-5c26a1e32821).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
