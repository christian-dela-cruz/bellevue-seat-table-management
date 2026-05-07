# Bellevue Manila Seat Table Management System - User Manual

## Table of Contents
1. [System Overview](#system-overview)
2. [Administrator Guide](#administrator-guide)
3. [Client/Customer Guide](#clientcustomer-guide)
4. [Outlet Manager Guide](#outlet-manager-guide)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

---

## System Overview

The Bellevue Manila Seat Table Management System is a comprehensive reservation platform that allows customers to reserve seats and tables across multiple venues within the hotel. The system features real-time updates, automated notifications, and an intuitive interface for both customers and administrators.

### Key Features
- **Multi-Venue Support**: Main Wing, Tower Wing, and various function rooms
- **Real-Time Seat Management**: Live seat status updates with color coding
- **Reservation Types**: Table reservations, individual seat reservations, and standalone seat bookings
- **Admin Dashboard**: Comprehensive reservation management with approval workflows
- **WebSocket Integration**: Instant updates across all connected clients
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices

### Venue Structure
- **Main Wing**: Alabang Function Room, 20-20 Function Rooms A & B
- **Tower Wing**: Tower Ballroom 1, Tower Ballroom 2, Tower Ballroom 3
- **Grand Ballroom**: Grand Ballroom A, B, C

---

## Administrator Guide

### Access and Login
1. Navigate to `/admin` in your browser
2. Use credentials:
   - Username: `admin`
   - Password: `admin123`
3. Click "Login" to access the dashboard

### Dashboard Overview

#### Main Features
- **Reservation List**: View all reservations with status indicators
- **Search & Filter**: Find reservations by name, date, status, or venue
- **Approval Actions**: Approve, reject, or modify reservations
- **Real-Time Updates**: See live seat map changes as reservations are made

#### Status Indicators
- 🔴 **Red**: Approved/Reserved (seat taken)
- 🟡 **Gold**: Pending (awaiting approval)
- 🟢 **Green**: Available/Rejected (seat free)
- ⚪ **Gray**: Unavailable/maintenance

### Managing Reservations

#### View Reservation Details
1. Click on any reservation in the list
2. View complete reservation information including:
   - Customer details
   - Venue and table/seat information
   - Event date and time
   - Special requests

#### Approval Process
1. **Approve Reservation**:
   - Click the green "Approve" button
   - Seat status immediately changes to red (reserved)
   - Customer receives notification (if configured)

2. **Reject Reservation**:
   - Click the red "Reject" button
   - Seat status changes to green (available)
   - Customer receives cancellation notification

3. **Modify Reservation**:
   - Click "Edit" to change details
   - Update date, time, or seating preferences
   - Save changes to update reservation

#### Search and Filter
- **By Name**: Type customer name in search box
- **By Date**: Use date picker to filter by event date
- **By Status**: Select from dropdown (Pending, Approved, Rejected)
- **By Venue**: Filter by specific venue or room

### Seat Map Management
- View real-time seat availability
- Click on any seat to see reservation details
- Monitor venue capacity and utilization
- Export reservation data for reporting

### Notifications Management
As the outlet manager, you can configure:
- Email notifications for customers
- SMS alerts (if integrated)
- Internal staff notifications
- Automated reminders

---

## Client/Customer Guide

### Accessing the System
1. Navigate to the main venue page
2. Browse available venues and function rooms
3. Click "View & Reserve" on your preferred venue

### Making a Reservation

#### Step 1: Select Venue
- Browse available venues (Main Wing, Tower Wing, etc.)
- View venue details and capacity
- Click "View & Reserve" to proceed

#### Step 2: Choose Seating
**Table Reservation**:
1. Click on an available table
2. Select number of guests
3. Proceed to details

**Individual Seat Reservation**:
1. Click "Select Individual Seats"
2. Click on available seats (green)
3. Proceed to details

**Standalone Seat Reservation**:
1. Click on standalone seats outside tables
2. Proceed to details

#### Step 3: Enter Details
1. **Personal Information**:
   - First Name and Last Name
   - Email address
   - Phone number

2. **Event Details**:
   - Event date
   - Event time
   - Special requests (dietary needs, accessibility, etc.)

#### Step 4: Review and Confirm
1. Review all reservation details
2. Check seating selection
3. Click "Confirm Reservation"

#### Step 5: Confirmation
1. Receive reference code
2. Save confirmation details
3. Wait for admin approval (status will show as "Pending")

### Understanding Seat Status
- 🟢 **Green**: Available for reservation
- 🟡 **Gold**: Pending approval
- 🔴 **Red**: Already reserved/approved
- ⚪ **Gray**: Not available

### Managing Your Reservation

#### View Reservation Status
1. Use reference code to check status
2. Status updates in real-time
3. Receive notifications when approved/rejected

#### Modify or Cancel
1. Contact venue staff directly
2. Provide reference code
3. Request changes or cancellation

### Mobile Experience
The system is fully responsive:
- Works on smartphones and tablets
- Touch-friendly interface
- Optimized for mobile browsers

---

## Outlet Manager Guide

### Notification Management

#### Setting Up Notifications
1. Access admin dashboard
2. Navigate to "Settings" > "Notifications"
3. Configure notification preferences:
   - Email templates
   - SMS settings
   - Notification timing

#### Email Notifications
**Customer Notifications**:
- Reservation confirmation
- Approval notifications
- Rejection notifications
- Event reminders

**Staff Notifications**:
- New reservation alerts
- Cancellation notices
- Capacity warnings

#### Managing Notification Content
1. Edit email templates
2. Customize SMS messages
3. Set up automated reminders
4. Configure notification schedules

### Reporting and Analytics

#### Key Metrics
- Reservation volume by venue
- Peak booking times
- Customer preferences
- Revenue tracking

#### Export Data
1. Go to "Reports" section
2. Select date range and venue
3. Choose export format (CSV, PDF)
4. Download reports for analysis

### Capacity Management

#### Monitor Venue Utilization
- Real-time capacity tracking
- Seating arrangement optimization
- Event scheduling conflicts
- Staff allocation planning

#### Adjust Venue Settings
1. Update venue capacity
2. Modify seating layouts
3. Set up special event configurations
4. Manage maintenance schedules

---

## Troubleshooting

### Common Issues

#### For Administrators
**Problem**: Reservations not appearing in dashboard
**Solution**: 
1. Check internet connection
2. Refresh browser page
3. Verify WebSocket connection
4. Contact technical support

**Problem**: Seat status not updating after approval
**Solution**:
1. Check WebSocket connection status
2. Verify API endpoints are responding
3. Clear browser cache and refresh
4. Ensure polling fallback is active

#### For Customers
**Problem**: Can't complete reservation
**Solution**:
1. Check all required fields are filled
2. Verify email format is correct
3. Ensure selected seats are available
4. Try refreshing the page

**Problem**: Payment issues (if applicable)
**Solution**:
1. Check payment details
2. Verify card information
3. Try alternative payment method
4. Contact venue directly

#### For Outlet Managers
**Problem**: Notifications not sending
**Solution**:
1. Check email server configuration
2. Verify SMTP settings
3. Test notification templates
4. Check spam filters

### Technical Support
For technical issues, contact:
- Email: support@bellevue-manila.com
- Phone: +63 2 XXX XXXX
- Available: 24/7 for critical issues

---

## FAQ

### General Questions
**Q: Can I make reservations for multiple venues at once?**
A: No, each reservation is for a specific venue and time slot.

**Q: How far in advance can I book?**
A: Reservations can be made up to 6 months in advance.

**Q: Is there a cancellation policy?**
A: Cancellations must be made at least 24 hours before the event.

### For Customers
**Q: How do I know if my reservation is confirmed?**
A: You'll receive an email confirmation and the seat status will change from gold (pending) to red (approved).

**Q: Can I change my reservation after booking?**
A: Yes, contact the venue staff with your reference code to make changes.

**Q: What happens if I'm late for my reservation?**
A: Your reservation will be held for 15 minutes past the scheduled time.

### For Administrators
**Q: Can I bulk approve multiple reservations?**
A: Yes, select multiple reservations and use the bulk approve feature.

**Q: How do I handle overbooking situations?**
A: The system prevents overbooking by showing real-time availability.

**Q: Can I export reservation data for accounting?**
A: Yes, use the Reports section to export data in various formats.

---

## System Requirements

### For Administrators
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection
- Minimum screen resolution: 1024x768

### For Customers
- Any modern web browser
- Internet connection (mobile or desktop)
- JavaScript enabled

### For Outlet Managers
- Admin access credentials
- Email server access for notifications
- Basic technical knowledge for configuration

---

## Security Considerations

### Data Protection
- All customer data is encrypted
- Secure payment processing (if applicable)
- Regular security updates
- Compliance with data protection regulations

### Access Control
- Role-based permissions
- Secure login authentication
- Session timeout protection
- Audit trail for all actions

---

## Contact Information

**Technical Support**
- Email: tech-support@bellevue-manila.com
- Phone: +63 2 XXX XXXX

**Customer Service**
- Email: reservations@bellevue-manila.com
- Phone: +63 2 XXX XXXX

**Venue Management**
- Main Wing: +63 2 XXX XXXX
- Tower Wing: +63 2 XXX XXXX
- Grand Ballroom: +63 2 XXX XXXX

---

*Last Updated: April 2026*
*Version: 1.0*
