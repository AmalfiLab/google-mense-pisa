const admin = require('firebase-admin');
const axios = require('axios').default;
const { MenuParser, options } = require('@amalfilab/dsu-menu-parser');

admin.initializeApp();
const db = admin.firestore();

const urlTemplates = {
  martiri: "https://www.dsu.toscana.it/it/Menù-dal-${START}-al-${END}-martiri.pdf",
  rosellini: "https://www.dsu.toscana.it/it/Menù-dal-${START}-al-${END}-rosellini.pdf",
  betti: "https://www.dsu.toscana.it/it/Menù-dal-${START}-al-${END}-betti.pdf"
};

function applyUrlTemplate(template, startDate, endDate) {
  let sDay = startDate.getDate();
  let sMonth = startDate.getMonth() + 1;
  const sYear = startDate.getFullYear();
  let eDay = endDate.getDate();
  let eMonth = endDate.getMonth() + 1;
  const eYear = endDate.getFullYear();

  if (sDay <= 9) sDay = "0" + sDay;
  if (sMonth <= 9) sMonth = "0" + sMonth;
  if (eDay <= 9) eDay = "0" + eDay;
  if (eMonth <= 9) eMonth = "0" + eMonth;

  return encodeURI(template
    .replace('${START}', `${sDay}.${sMonth}.${sYear}`)
    .replace('${END}', `${eDay}.${eMonth}.${eYear}`));
}

function getMenuLinks(startDate, endDate) {  
  let links = {};
  for (key in urlTemplates) {
    links[key] = applyUrlTemplate(urlTemplates[key], startDate, endDate);
  }
  return links;
}

async function downloadPdf(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return res.data;
}

async function updateDatabase(newMenu, idMensa) {
  const menuDoc = await db.collection('menu').doc(idMensa).get();
  let data = (menuDoc.exists) ? menuDoc.data() : { };
  let menu = (data.menu) ? data.menu : { };

  for (const elem of newMenu) {
    menu[elem.date] = {
      launch: elem.launch,
      dinner: elem.dinner
    };
  }

  data = { 
    ...data,
    menu,
    updateAt: (new Date()).toISOString()
  };
  await db.collection('menu').doc(idMensa).set(data);
}

function getStartEndDates(deltaWeek) {
  const now = new Date();
  const nowDay = now.getUTCDay();

  let startDate = new Date(
    now.getFullYear(), now.getMonth(), now.getDate() - nowDay + 1 + deltaWeek*7);
  let endDate = new Date(
    now.getFullYear(), now.getMonth(), now.getDate() - nowDay + 7 + deltaWeek*7);
  startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
  endDate.setMinutes(endDate.getMinutes() - endDate.getTimezoneOffset());
  return { startDate, endDate };
}

async function getMenu(parser, parserOpts, startDate) {
  let dates = [ startDate ];
  const daysInWeek = 7;
  for (let i = 1; i < daysInWeek; ++i) {
    let d = new Date(dates[i - 1].getTime());
    d.setDate(d.getDate() + 1);
    dates.push(d);
  }

  let menu = [];
  for (const date of dates) {
    let elem = { date: date.toISOString() };
  
    if (parserOpts.openDays.includes(parseInt(date.getDay()))) {
      const day = (date.getDay() >= 1) ? date.getDay() - 1 : 6;
      const launch = (await parser.getMenu(day, 'launch')).join('; ');
      let dinner = "";
      if (parserOpts.dinner)
        dinner = (await parser.getMenu(day, 'dinner')).join('; ');
      else
        dinner = "Mensa chiusa";
      elem = { ...elem, launch, dinner };
    } else {
      elem = { ...elem, launch: "Mensa chiusa", dinner: "Mensa chiusa" };
    }

    menu.push(elem);
  }

  return menu;
}

async function fetchAndParseMenu(url, parserOpts, startDate) {
  const buffer = await downloadPdf(url).catch(err => {
    throw `Error while downloading pdf from ${url}. ${err.message}`;
  });
  const parser = new MenuParser(buffer, parserOpts)
  const menu = await getMenu(parser, parserOpts, startDate);
  return menu;
}  

async function main(request) {
  const { canteen, deltaWeek } = request;

  const { startDate, endDate } = getStartEndDates(deltaWeek);
  const url = getMenuLinks(startDate, endDate)[canteen];
  const menu = await fetchAndParseMenu(url, options[canteen], startDate);
  await updateDatabase(menu, canteen);
}

exports.fetchAndUpdateMenu = main;