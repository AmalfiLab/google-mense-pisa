const functions = require('firebase-functions');
const { fetchAndUpdateMenu } = require('./crawler');

const canteens = ['martiri', 'betti', 'rosellini'];

exports.fetchAndUpdateNextWeekMenu = functions.pubsub.schedule('0 9 * * 6')
  .timeZone('Europe/Rome')
  .onRun(context => {
    for (const canteen of canteens) {
      try {
        fetchAndUpdateMenu({ canteen: 'martiri', deltaWeek: 1 });
      } catch (error) {
        console.error(`error with updating ${canteen}`, error);
      }
    }
  });