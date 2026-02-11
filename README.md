# HVAC AI Secretary

AI-powered customer service assistant for HVAC businesses - handles chat, SMS, and appointment booking 24/7.

## Features

- **Live Chat Widget**: Embeddable chat interface for your website
- **SMS Integration**: Automated SMS notifications via Twilio
- **Appointment Booking**: Smart scheduling with availability checking
- **Customer Management**: Complete CRM with service history
- **24/7 Availability**: AI-powered responses anytime

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **SMS**: Twilio
- **Frontend**: Vanilla JavaScript (embeddable widget)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Twilio account (for SMS)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/dutchiono/hvac-ai-secretary.git
cd hvac-ai-secretary
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE hvac_crm;"
sudo -u postgres psql -c "CREATE USER hvacuser WITH ENCRYPTED PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hvac_crm TO hvacuser;"

# Import schema
psql -U hvacuser -d hvac_crm -f hvac-crm-schema.sql
```

5. Start the server:
```bash
npm start
# For development with auto-reload:
npm run dev
```

## Project Structure

```
hvac-ai-secretary/
├── server.js              # Main Express server
├── routes/
│   ├── chat.js           # Chat API endpoints
│   ├── appointments.js   # Appointment booking
│   ├── customers.js      # Customer management
│   └── sms.js            # SMS utilities
├── chat-widget.html      # Embeddable chat widget
├── hvac-crm-schema.sql   # Database schema
├── package.json          # Dependencies
├── env.example           # Environment template
├── DEPLOYMENT.md         # Production deployment guide
└── README.md            # This file
```

## API Endpoints

### Chat
- `POST /api/chat/start` - Start a new chat session
- `POST /api/chat/message` - Send a message
- `GET /api/chat/history/:sessionId` - Get chat history

### Appointments
- `POST /api/appointments/create` - Create appointment
- `GET /api/appointments/availability` - Check available slots
- `GET /api/appointments/list` - List appointments
- `PUT /api/appointments/:id/status` - Update status

### Customers
- `GET /api/customers/phone/:phone` - Get customer by phone
- `POST /api/customers/create` - Create customer
- `PUT /api/customers/:id` - Update customer

## Embedding the Chat Widget

Add this to your website:

```html
<iframe 
  src="https://your-domain.com/chat-widget.html" 
  style="position: fixed; bottom: 20px; right: 20px; width: 380px; height: 600px; border: none; border-radius: 12px; box-shadow: 0 5px 40px rgba(0,0,0,0.16);"
  allow="geolocation; microphone">
</iframe>
```

Or include it directly in your page and customize the styles.

## Configuration

Key environment variables:

```bash
# Server
PORT=3001
NODE_ENV=production

# Database
DB_HOST=localhost
DB_NAME=hvac_crm
DB_USER=hvacuser
DB_PASSWORD=your_password

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Business Info
BUSINESS_NAME=Your HVAC Company
BUSINESS_PHONE=+1234567890
BUSINESS_EMAIL=contact@yourhvac.com
```

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production setup instructions including:
- Server setup (Ubuntu/Linux)
- PostgreSQL configuration
- Nginx reverse proxy
- SSL certificates
- PM2 process management
- Monitoring and logging

## Database Schema

The system uses a normalized PostgreSQL schema with tables for:
- `customers` - Customer information and contact details
- `appointments` - Service appointments and scheduling
- `chat_sessions` - Chat conversation history
- `sms_logs` - SMS message tracking
- `service_history` - Complete service records

See `hvac-crm-schema.sql` for the complete schema.

## SMS Templates

Pre-built SMS templates for:
- Appointment confirmations
- Appointment reminders
- Technician en-route notifications
- Service completion
- Payment reminders
- Review requests
- Emergency responses
- Follow-up maintenance

## Security Features

- Helmet.js security headers
- CORS configuration
- Input validation
- SQL injection prevention (parameterized queries)
- Environment variable protection
- SSL/TLS encryption (in production)

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run database setup
npm run db:setup
```

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/dutchiono/hvac-ai-secretary/issues
- Email: dutchiono@gmail.com

## License

MIT License - see LICENSE file for details

## Author

Dutch Iono

---

Built with ❤️ for HVAC businesses looking to automate customer service and grow their business.
