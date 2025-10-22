import { createApp } from './app.js'; 
import { initMailer } from './services/mailer.js'; 

// Create the Express app instance by calling the function from app.js
const app = createApp();

// Define the port, using the environment variable or defaulting to 3000
const PORT = process.env.PORT || 3000;

/**
 * Asynchronous function to handle the application's startup sequence.
 * It ensures that essential services like the mailer are initialized
 * BEFORE the server starts accepting HTTP requests.
 */
async function startServer() {
  try {
    // 1. Initialize the mailer and wait for it to be ready.
    //    The 'await' keyword pauses execution until initMailer() is complete.
    console.log('Initializing services...');
    await initMailer();
    console.log('Services initialized successfully.');

    // 2. Once all services are ready, start the Express server.
    //    The server will now be able to handle requests, and the mailer
    //    will be available to all routes.
    app.listen(PORT, () => {
      console.log(` Server is running and listening on port ${PORT}`);
    });
  } catch (error) {
    // If any part of the startup fails (e.g., mailer can't connect),
    // log the fatal error and exit the application.
    console.error(' Fatal error during server startup:', error);
    process.exit(1); // Exit with a failure code
  }
}

// Execute the startup function to launch the application
startServer();