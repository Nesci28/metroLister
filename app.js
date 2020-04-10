const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const random_useragent = require('random-useragent');
const Excel = require('exceljs');
const axios = require('axios');
const removeDiacritics = require('diacritics').remove;

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
require('https').globalAgent.options.ca = require('ssl-root-cas').create();

puppeteer.use(StealthPlugin());

require('dotenv').config();

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

const workbook = new Excel.Workbook();
const worksheet = workbook.addWorksheet('list');
worksheet.columns = [
  { header: 'image', key: 'image', width: 13.57 },
  { header: 'name', key: 'productName', width: 68 },
  { header: 'brand', key: 'productBrand', width: 10 },
  { header: 'quantity', key: 'productQties', width: 8.43 },
  { header: 'price', key: 'productQties', width: 8.43 },
  { header: 'substitution', key: 'productSubstitution', width: 13.57 },
  { header: 'code', key: 'productCodes', width: 13.57 },
];

(async () => {
  if (!fs.existsSync('./list')) {
    fs.mkdirSync('./list');
  }

  let json;
  let index = getFileNameIndex();

  if (process.argv[process.argv.length - 1] === 'generate') {
    index = index + 1;
    const options = {
      headless: false,
      slowMo: 10,
      defaultViewport: null,
    };
    if (!fs.existsSync(`./list/list-${index}`)) {
      fs.mkdirSync(`./list/list-${index}`);
      fs.mkdirSync(`./list/list-${index}/images`);
    }

    console.log('Launching browser');
    const browser = await puppeteer.launch(options);
    const page = await browser.newPage();
    await page.setUserAgent(
      random_useragent.getRandom((ua) => {
        return ua.browserName === 'Chrome';
      }),
    );
    await page.setDefaultNavigationTimeout(0);
    console.log('Navigating to metro.ca');
    await page.goto('https://metro.ca/fr/');

    console.log('Signing In');
    await signIn(page);

    console.log('Going to Cart');
    await goToCart(page);

    console.log('Generating JSON');
    json = await generateJSON(page, index);

    fs.writeFileSync(
      `./list/list-${index}/list${index}.json`,
      JSON.stringify(json),
    );
    await browser.close();
  }

  if (!json) {
    json = JSON.parse(
      fs.readFileSync(`./list/list-${index}/list${index}.json`).toString(),
    );
  }
})();

function getFileNameIndex() {
  const files = fs.readdirSync('./list');
  if (files.length === 0) {
    return 1;
  }
  const indexes = [];
  files.forEach((file) => {
    indexes.push(file.replace(/\D/g, ''));
  });
  return Math.max(...indexes);
}

async function generateJSON(page, index) {
  await page.waitForSelector(
    '#cart > div.grid-container-small.cart--my-basket.grid-container--full-mobile.grid-container--full-tablet > div > div.col-xl-9.cart--left > div.cart--mb-basket > div.cartBasketContainer > div.basket-product-tiles > form > div:nth-child(3)',
    {
      visible: true,
    },
  );

  console.log('waiting 1 sec');
  await page.waitFor(1000);
  console.log('done');

  const productImages = await page.evaluate(() =>
    [...document.querySelectorAll('.defaultable-picture')].map(
      (element) => element.src,
    ),
  );

  const productNames = await page.evaluate(() =>
    [...document.querySelectorAll('.product-details-link')]
      .map((element) => element.text)
      .filter((x) => x.trim()),
  );
  await downloadImages(productNames, productImages, index);
  const productCodes = await page.evaluate(() =>
    [...document.querySelectorAll('.product-card')].map((element) =>
      element.getAttribute('data-product-code'),
    ),
  );
  const productQties = await page.evaluate(() =>
    [...document.querySelectorAll('.product-card')].map((element) =>
      element.getAttribute('data-qty'),
    ),
  );
  const productPrices = await page.evaluate(() =>
    [...document.querySelectorAll('.subtotal-value')].map(
      (element) => element.innerHTML,
    ),
  );
  const productBrand = await page.evaluate(() =>
    [...document.querySelectorAll('.pc--brand')].map(
      (element) => element.innerHTML,
    ),
  );
  let productSubstitution = await page.evaluate(() =>
    [...document.querySelectorAll('input[type="checkbox"]')].map(
      (element) => element.checked,
    ),
  );
  productSubstitution.pop();
  productSubstitution = productSubstitution.filter((_, index) => !(index % 2));

  await addToExcelImages(productNames, index);
  await addToExcel(productNames, 'B');
  await addToExcel(productBrand, 'C');
  await addToExcel(productQties, 'D');
  await addToExcel(productPrices, 'E');
  await addToExcel(productSubstitution, 'F');
  await addToExcel(productCodes, 'G');

  productNames.forEach((_, i) => {
    worksheet.getRow(i + 2).height = 75;
  });

  await workbook.xlsx.writeFile(`./list/list-${index}/list${index}.xlsx`);

  const list = [];
  productNames.forEach((productName) => {
    list.push({
      productName,
    });
  });
  productBrand.forEach((brand, i) => {
    list[i].brand = brand;
  });
  productQties.forEach((quantity, i) => {
    list[i].quantity = quantity;
  });
  productPrices.forEach((price, i) => {
    list[i].price = price;
  });
  productSubstitution.forEach((substitution, i) => {
    list[i].substitution = substitution ? 'oui' : 'non';
  });
  productCodes.forEach((productCode, i) => {
    list[i].productCode = productCode;
  });

  return list;
}

async function addToExcelImages(productNames, index) {
  for (let i = 0; i < productNames.length; i++) {
    const name = productNames[i];
    const image = workbook.addImage({
      filename: `./list/list-${index}/images/${removeDiacritics(
        name.replace(/ /g, '').replace(/"/g, ''),
      )}.jpg`,
      extension: 'jpg',
    });
    worksheet.addImage(image, {
      tl: { col: 0, row: i + 1 },
      br: { col: 1, row: i + 2 },
      ext: { width: 75, height: 75 },
    });
  }
}

async function addToExcel(infos, cellIndex) {
  for (let i = 0; i < infos.length; i++) {
    let info = infos[i];
    const cell = worksheet.getCell(`${cellIndex}${i + 2}`);
    if (info === true) {
      info = 'oui';
    } else if (info === false) {
      info = 'non';
    }
    cell.value = info;
  }
}

async function downloadImages(productNames, productImages, index) {
  for (let i = 0; i < productNames.length; i++) {
    const name = removeDiacritics(
      productNames[i].replace(/ /g, '').replace(/"/g, ''),
    );
    const res = await axios({
      url: productImages[i],
      method: 'GET',
      responseType: 'stream',
    });
    res.data.pipe(
      fs.createWriteStream(`./list/list-${index}/images/${name}.jpg`),
    );
  }
}

async function goToCart(page) {
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  await page.waitForSelector('#my-cart-link', {
    visible: true,
  });
  await page.click('#my-cart-link');
  return;
}

async function signIn(page) {
  await page.waitForSelector('#popover-sign-in-box-button', {
    visible: true,
  });
  await page.click('#popover-sign-in-box-button');
  await page.waitForSelector('#username', {
    visible: true,
  });
  await page.click('#username');
  await page.type('#username', EMAIL);
  await page.click('#password');
  await page.type('#password', PASSWORD);
  await page.click('#popover-sign-in-box-submit');
  return;
}
