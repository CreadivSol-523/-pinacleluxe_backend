// emailService.js
import sgMail from "@sendgrid/mail";

sgMail.setApiKey("SG.xxxxxxxxxxxxxxxxx");

const SendGridMailer = async ({ to, subject, html }) => {
   console.log("imtiazhasan873@gmail.com", "Sender Email");
   const msg = {
      to,
      from: "imtiazhasan873@gmail.com",
      subject,
      html,
   };

   try {
      const [response] = await sgMail.send(msg);

      const messageId = response.headers["x-message-id"] || response.headers["x-message-id"];
      console.log("✅ Email sent successfully");
      console.log("📨 SendGrid Message ID:", messageId || "Not available");
      return true;
   } catch (error) {
      console.error("Error sending email:", error.response?.body || error.message);
      return false;
   }
};

export default SendGridMailer;
