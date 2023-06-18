const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('');
const connectingD=async()=>{
    await mongoose.connect('mongodb+srv://dpuser:dpUser@blog-app2.hfxckhs.mongodb.net/?retryWrites=true&w=majority', {
       useNewUrlParser: true,
       useUnifiedTopology: true
     })
     .then(() => {
       console.log('Connected to the database');
     })
     .catch((err) => {
       console.log('Error connecting to the database', err);
     });
   
   }
   connectingD();
// Define the seat schema
const seatSchema = new mongoose.Schema({
  seatNumber: String,
  seatClass: String,
  isBooked: Boolean,
  minPrice: Number,
  normalPrice: Number,
  maxPrice: Number,
});
const Seat = mongoose.model('Seat', seatSchema);

// Create a booking schema
const bookingSchema = new mongoose.Schema({
  seatIds:{type:mongoose.Types.ObjectId, ref:"Seat"},
  name: String,
  email:{type:String,required:true},
  phoneNumber: String,
});
const Booking = mongoose.model('Booking', bookingSchema);

// Middleware to parse request body
app.use(bodyParser.json());

// Get all seats ordered by seat class
app.get('/seats', async (req, res) => {
  try {
    const seats = await Seat.find().sort('seatClass');
    res.json(seats);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get seat details and pricing based on seat id
app.get('/seats/:id', async (req, res) => {
  try {
    const seat = await Seat.findById(req.params.id);
    if (!seat) {
      return res.status(404).json({ error: 'Seat not found' });
    }

    let pricing = seat.normalPrice;
    const totalSeats = await Seat.countDocuments({ seatClass: seat.seatClass });
    const bookedSeats = await Seat.countDocuments({
      seatClass: seat.seatClass,
      isBooked: true,
    });
    const bookedPercentage = (bookedSeats / totalSeats) * 100;

    if (bookedPercentage < 40) {
      pricing = seat.minPrice || seat.normalPrice;
    } else if (bookedPercentage > 60) {
      pricing = seat.maxPrice || seat.normalPrice;
    }

    res.json({ seat, pricing });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create a booking
app.post('/booking', async (req, res) => {
  const { seatIds, name, phoneNumber,email } = req.body;
  
  // Check if any of the selected seats are already booked
  const bookedSeats = await Seat.findOne({ _id: { $in: seatIds } });
  if (bookedSeats.isBooked ==true) {
    return res.status(400).json({ error: 'Some seats are already booked' });
  }
  
 
  // Function to send booking confirmation email
  async function sendBookingConfirmationEmail(email, savedBooking) {
   
    const msg = {
      to: email,
      from: 'biswajit.materiallibrary@gmail.com', // Update with your email address
      subject: 'Booking Confirmation',
      text: 'Your seat booking has been confirmed.',
      html: `<p>Booking details:</p>
             <ul>
             <li>Booking-Id: ${savedBooking._id}</li>
             <li>Seat No: ${bookedSeats.seatNumber}</li>
             <li>Seat class: ${bookedSeats.seatClass}</li>
               <li>Name: ${savedBooking.name}</li>
               <li>Date & Time: ${Date.now()}</li>
               <li>TotalAmount: ${bookedSeats.maxPrice + 150}</li>
             </ul>`
    };
  
    try {
      await sgMail.send(msg);
      console.log('Booking confirmation email sent successfully');
    } catch (error) {
      console.error('Error sending booking confirmation email:', error);
    }
  }
  
  // Example usage:
  
  //const email = 'john@example.com';
  
  
  // Create the booking
  const booking = new Booking({
    seatIds,
    name,
    phoneNumber,
    email
  });

  try {
    const savedBooking = await booking.save();
    // Update the seats to mark them as booked
   
    await Seat.findOneAndUpdate(
      { _id: { $in: seatIds } },
      { $set: { isBooked: true } }
    );
 await   sendBookingConfirmationEmail(email, savedBooking);
    res.json({
      bookingId: savedBooking._id,
      totalAmount:bookedSeats.maxPrice + 150  , //tax per seat 150
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Retrieve bookings by user identifier (email or phone number)
app.get('/bookings', async (req, res) => {
  const userIdentifier = req.query.userIdentifier;
  if (!userIdentifier) {
    return res.status(400).json({ error: 'User identifier is required' });
  }

  try {
    const bookings = await Booking.find({
      $or: [{ email: userIdentifier }, { phoneNumber: userIdentifier }],
    }).populate("seatIds");
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the server
app.listen(9000, () => {
  console.log('Server listening on port 9000');
});
