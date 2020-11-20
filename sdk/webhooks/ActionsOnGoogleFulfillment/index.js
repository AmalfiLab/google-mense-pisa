const { conversation } = require('@assistant/conversation');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const app = conversation();

function getMenu(menuDoc, dateStr, meal) {
  if (!menuDoc.exists) return undefined;
  if (!menuDoc.data().menu) return undefined;
  if (!menuDoc.data().menu[dateStr]) return undefined;
  return menuDoc.data().menu[dateStr][meal];
}

app.handle('get_menu', async conv => {
  const { canteen, when, meal } = conv.session.params;
  let queryDate = (when) ? new Date(when.year, when.month - 1, when.day) : new Date();
  queryDate.setMinutes(queryDate.getMinutes() - queryDate.getTimezoneOffset());
  const queryMeal = (meal) ? meal : 'launch';
  
  const menuDoc = await db.collection('menu').doc(canteen).get();
  const menu = getMenu(menuDoc, queryDate.toISOString(), queryMeal);
  if (!menu) {
    conv.add(`Il menu della ${canteen} non è disponibile.`);
  } else {
    conv.add(`Alla ${canteen} c'è: ${menu}`);
  }
  conv.scene.next.name = 'actions.scene.END_CONVERSATION';
  
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
