const { conversation, Card } = require('@assistant/conversation');
const functions = require('firebase-functions');
const { warn, info } = require('firebase-functions/lib/logger');
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

function getWhenOrDefault(when) {
  let queryDate;
  if (when) {
    queryDate = new Date(when.year, when.month - 1, when.day);
  } else {
    const now = new Date();
    queryDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  queryDate.setMinutes(queryDate.getMinutes() - queryDate.getTimezoneOffset());
  console.log("Timezone offset: ", queryDate.getTimezoneOffset());
  return queryDate;
}

function getMealOrDefault(meal, queryDate) {
  if (meal) return meal;
  
  const now = new Date();
  const isTodayQuery = now.getFullYear() == queryDate.getFullYear() &&
                       now.getMonth() == queryDate.getMonth() &&
                       now.getDate() == queryDate.getDate();
  const out = (isTodayQuery && now.getUTCHours() > 14) ? 'dinner' : 'launch';
  
  info("meal: " + out, { isTodayQuery, nowHours: now.getUTCHours() });
  return out;
}

function getSpeakOutResponse(menu, canteen, meal, queryDate) {
  const canteenUpper = canteen.charAt(0).toUpperCase() + canteen.slice(1);
  const mealOut = (meal == 'launch') ? 'pranzo' : 'cena';
  return `A ${mealOut} alla ${canteenUpper} c'è: ${menu}.`;
}

function getCardResponse(menu, canteen, meal, queryDate) {
  const canteenUpper = canteen.charAt(0).toUpperCase() + canteen.slice(1);
  const mealOut = (meal == 'launch') ? 'pranzo' : 'cena';
  const dateStr = queryDate.getDate() + "/" + (queryDate.getMonth() + 1);
  return new Card({
    title: canteenUpper,
    subtitle: dateStr + '-' + mealOut,
    text: menu
  });
}

app.handle('get_menu', async conv => {
  const { canteen, when, meal } = conv.session.params;
  console.log("request:", {canteen, when, meal});

  const queryDate = getWhenOrDefault(when);
  const queryMeal = getMealOrDefault(meal, queryDate);
  console.log("query:", {queryDate, queryMeal});
  
  const menuDoc = await db.collection('menu').doc(canteen).get();
  const menu = getMenu(menuDoc, queryDate.toISOString(), queryMeal);

  if (!menu) {
    conv.add(`Il menu della ${canteen} non è disponibile.`);
  } else {
    conv.add(getSpeakOutResponse(menu, canteen, queryMeal, queryDate));
    conv.add(getCardResponse(menu, canteen, queryMeal, queryDate));
  }
  conv.scene.next.name = 'PreEnd';
});

exports.ActionsOnGoogleFulfillment = functions.https.onRequest(app);
