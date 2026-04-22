import { LocalNotifications } from '@capacitor/local-notifications';

export const NotificationService = {
  requestPermissions: async () => {
    try {
      const permStatus = await LocalNotifications.requestPermissions();
      return permStatus.display === 'granted';
    } catch (e) {
      console.warn("LocalNotifications not available inside browser:", e);
      return false;
    }
  },

  scheduleSpontaneousSpasm: async (levelId) => {
    try {
      let maxIntervalMinutes;
      switch(levelId) {
        case 'toy': maxIntervalMinutes = 60; break;
        case 'servant': maxIntervalMinutes = 15; break;
        case 'slave': maxIntervalMinutes = 5; break;
        case 'property': maxIntervalMinutes = 1; break; 
        default: maxIntervalMinutes = 60;
      }

      await LocalNotifications.cancel({ notifications: [{ id: 444 }] });

      // Calculate a random time between 1 and the max interval allowed by the tier
      const randomMinutes = Math.floor(Math.random() * maxIntervalMinutes) + 1;
      const triggerDate = new Date(new Date().getTime() + randomMinutes * 60000);

      await LocalNotifications.schedule({
        notifications: [
          {
            title: "The Architect Demands Compliance",
            body: "Immediate visual inspection required. Submit to the Gaze now.",
            id: 444,
            schedule: { at: triggerDate },
            sound: null,
            attachments: null,
            actionTypeId: "",
            extra: null
          }
        ]
      });

      console.log(`[Architect] Next spontaneous inspection scheduled in ${randomMinutes} minutes for level: ${levelId}`);
    } catch (e) {
      console.warn("Could not schedule push notification:", e);
    }
  }
};
