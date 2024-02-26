const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    // host:'smtp.gmail.com',
    // port: 465,
    // secure: true, // true for 465, false for other ports
    // auth: {
    //     user: '<EMAIL>', // generated ethereal user
    //     pass: '<PASSWORD>' // generated ethereal password
    // }

    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME, // generated ethereal user
      pass: process.env.EMAIL_PASSWORD, // generated ethereal password
    },
  });

  const mailOptions = {
    from: 'Devid Patel <test@1.io>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
