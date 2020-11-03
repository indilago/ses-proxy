import should from 'should'
import nodemailer from 'nodemailer'
import smtpTransport from 'nodemailer-smtp-transport'
import startServer from'../src/index'

describe('Send Email', function () {
  this.timeout(60000)

  before(done => {
    startServer({ port: 2525 })
    setTimeout(done, 200)
  });
  after(done => {
    // Wait a bit for the SES api call
    setTimeout(done, 15000)
  })

  it('should send an email successfully', testsDone => {
    // Create reusable transport object using SMTP transport
    const transport = nodemailer.createTransport(smtpTransport({
      host: 'localhost',
      port: 2525,
      // debug: true
    }))

    // Turn this on with the debug:true in smtpTransport
    transport.on('log', data => console.log(data))

    // setup e-mail data with unicode symbols
    const mailOptions = {
      from: process.env.FROM ? process.env.FROM : 'lisa@example.com',
      to: process.env.TO ? process.env.TO : 'home@example.com',
      subject: 'Hello ✔',
      text: 'Hello\nworld ✔',
      html: '<b>Hello<br>world ✔</b>'
    }

    // send mail with defined transport object
    transport.sendMail(mailOptions, (error, info) => {
      should(error).not.be.ok
      should(info).be.ok
      info.should.have.property('response')

      testsDone(error)
    })
  })
})
