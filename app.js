const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const { execSync } = require('child_process');

puppeteer.use(StealthPlugin());

require('dotenv').config();

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

(async () => {
  let json;
  let index = getFileNameIndex();

  if (!fs.existsSync('list')) {
    fs.mkdirSync('./list');
  }

  if (process.argv[0] === 'generate') {
    index = index + 1;
    const options = {
      headless: false,
      slowMo: 10,
      defaultViewport: null,
    };

    console.log('Launching browser');
    const browser = await puppeteer.launch(options);
    const page = await browser.newPage();
    await page.setUserAgent(
      '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
    );
    console.log('Navigating to metro.ca');
    await page.goto('https://metro.ca');

    console.log('Signing In');
    await signIn(page);

    console.log('Going to Cart');
    await goToCart(page);

    console.log('Generating JSON');
    json = await generateJSON(page, index);

    fs.writeFileSync(`./list/list${index}.json`, JSON.strinfify(json));
    await browser.close();
  }

  if (!json) {
    json = JSON.parse(fs.readFileSync(`./list/list${index}.json`).toString());
  }

  const csv = generateCSV(json);
  fs.writeFileSync(`./list/list${index}.csv`, csv);

  execSync(
    `column -t -s, -o, list/list${index}.csv | sed 's/,/\t/g' > list/list${index}_formatted.csv`,
  );
})();

function getFileNameIndex() {
  const files = fs.readdirSync('./list');
  const indexes = [];
  files.forEach(file => {
    indexes.push(file.replace(/\D/g, ''));
  });
  return Math.max(...indexes);
}

function generateCSV(json) {
  const header = Object.keys(json[0]);
  const replacer = (_, value) => (value === null ? '' : value);
  let csv = json.map(row =>
    header
      .map(fieldName =>
        JSON.stringify(row[fieldName].replace(/,/g, '.'), replacer),
      )
      .join(','),
  );
  csv.unshift(header.join(','));
  csv = csv.join('\r\n');
  return csv;
}

async function generateJSON(page) {
  await page.waitForSelector(
    '#cart > div.grid-container-small.cart--my-basket.grid-container--full-mobile.grid-container--full-tablet > div > div.col-xl-9.cart--left > div.cart--mb-basket > div.cartBasketContainer > div.basket-product-tiles > form > div:nth-child(3)',
    {
      visible: true,
    },
  );

  console.log('waiting 1 sec');
  await sleep(1000);
  console.log('done');

  const productCodes = await page.evaluate(() =>
    [...document.querySelectorAll('.product-card')].map(element =>
      element.getAttribute('data-product-code'),
    ),
  );
  const productNames = await page.evaluate(() =>
    [...document.querySelectorAll('.product-card')].map(element =>
      element.getAttribute('data-product-name'),
    ),
  );
  const productQties = await page.evaluate(() =>
    [...document.querySelectorAll('.product-card')].map(element =>
      element.getAttribute('data-qty'),
    ),
  );
  const productPrices = await page.evaluate(() =>
    [...document.querySelectorAll('.subtotal-value')].map(
      element => element.innerHTML,
    ),
  );

  const list = [];
  productCodes.forEach(productCode => {
    list.push({
      productCode,
    });
  });
  productNames.forEach((productName, i) => {
    list[i].productName = productName;
  });
  productQties.forEach((quantity, i) => {
    list[i].quantity = quantity;
  });
  productPrices.forEach((price, i) => {
    list[i].price = price;
  });

  return list;
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

const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};
