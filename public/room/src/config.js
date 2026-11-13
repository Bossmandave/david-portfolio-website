/* Site configuration.
 *
 * The Firebase web config is public by design — it identifies the project, it
 * does not authorise anything. All the protection lives in the Firestore
 * security rules (see firestore.rules), which is why the guestbook can be open
 * to anonymous visitors without exposing anything.
 *
 * Leave `firebase` null to run the room with the visitor book disabled.
 */
export const CONFIG = {
  firebase: {
    apiKey: 'AIzaSyCML41S4huSnAPDwxRt6c4U4iUSZj7IkIk',
    projectId: 'dave-portfolio3d',
  },
  contact: {
    email: 'agodidavid004@gmail.com',
    site: 'https://agodidavid.dev',
    github: 'https://github.com/Bossmandave',
    linkedin: 'https://www.linkedin.com/in/david-uchenna-agodi-369a88283',
  },
};
