/**
/* main.ts
/* ScrapingKeiba - Getting horse racing data. -
**/

"use strict";

//* Constants
const WINDOW_WIDTH: number = 1000; // window width
const WINDOW_HEIGHT: number = 1000; // window height
const CSV_ENCODING: string = 'Shift_JIS'; // csv encoding
const TARGET_URL: string = 'https://db.netkeiba.com/horse/sire/'; // base url

//* interfaces
// dialog options
interface DialogOptions{
  type: string;
  title: string;
  message: string;
  detail: string;
}

// records
interface Csvrecords {
  urls: string;
  horse: string;
}

// csv headers
interface Csvheaders {
  key: string;
  header: string;
}

//* Modules
import { app, BrowserWindow, dialog } from 'electron'; // Electron
import * as fs from 'fs'; // fs
import parse from 'csv-parse/lib/sync'; // CSV parser
import stringifySync from 'csv-stringify/lib/sync'; // csv stfingifier
import iconv from 'iconv-lite'; // Text converter
import { Scrape } from './class/myScraper'; // scraper\

//* Selectors
// base
const BASE_SELECTOR: string = '#contents > div.db_main_deta > table > tbody > tr:nth-child(3) >';
// turf
const TURF_SELECTOR: string = `${BASE_SELECTOR} td:nth-child(13) > a`;
// turf win
const TURF_WIN_SELECTOR: string = `${BASE_SELECTOR} td:nth-child(14) > a`;
// dirt
const DIRT_SELECTOR: string = `${BASE_SELECTOR} td:nth-child(15) > a`;
// dirt win
const DIRT_WIN_SELECTOR: string = `${BASE_SELECTOR} td:nth-child(16) > a`;
// turf average distance
const TURF_DIST_SELECTOR: string = `${BASE_SELECTOR} td:nth-child(20)`;
// dirt average distance
const DIRT_DIST_SELECTOR: string = `${BASE_SELECTOR} td:nth-child(21)`;

//* General variables
// main window
let mainWindow:any = null; 
// result array
let resultArray: Object[][] = []; 
// selector array
const selectorArray: string[] = [TURF_SELECTOR, TURF_WIN_SELECTOR, DIRT_SELECTOR, DIRT_WIN_SELECTOR, TURF_DIST_SELECTOR, DIRT_DIST_SELECTOR]; 
// header array
const headerObjArray: Csvheaders[] = [
  { key: 'a', header: 'horse' }, // horse name
  { key: 'b', header: 'turf' }, // turf ratio
  { key: 'c', header: 'turf win' }, // turf win
  { key: 'd', header: 'dirt' },  // dirt ratio
  { key: 'e', header: 'dirt win' }, // dirt win
  { key: 'f', header: 'turf distanse' }, // turf average distance
  { key: 'g', header: 'turf distanse' } // dirt average distance
];

// scraper
const scraper = new Scrape();

// main
app.on('ready', async () => {
  // Electron window
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH, // window width
    height: WINDOW_HEIGHT, // window height
    webPreferences: {
      nodeIntegration: false, // node
    },
  });
  // main html
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  // csv file dialog
  const promise: Promise<string> = new Promise((resolve, reject) => {
    // get csv
    getCsvData()
      // success
      .then((res: string[]) => {
        // chosen filename
        const filename:string = res[0];
        // resolved
        resolve(filename);
      })

      // error
      .catch((err: unknown) => {
        // error
        showDialog('no file', 'no csv file selected', err, true);
        // rejected
        reject(new Error('no file error'));
        // close window
        mainWindow.close();
    });
  });

  // file reading
  promise.then((name: string) => {
    try {
      // read file
      fs.readFile(name, async(err: any, data: any) => {
        // error
        if (err) throw err;

        // initialize
        await scraper.init();
        console.log(`scraping ${name}..`);

        // decoder
        const str: string = iconv.decode(data, CSV_ENCODING);
        // format date
        const formattedDate: string = (new Date).toISOString().replace(/[^\d]/g, "").slice(0, 14);

        // csv reading
        const tmpRecords: Csvrecords[] = await parse(str, {
          columns: ['urls', 'horse'], // column
          from_line: 2, // from line 2
        });
        // extract first column
        const urls: string[] = await tmpRecords.map(item => item.urls);
        const horses: string[] = await tmpRecords.map(item => item.horse);

        // loop words
        for (let i = 0; i < urls.length; i++) {
           // empty array
           let tmpArray: string[] = [];

           // insert horse name
           tmpArray.push(horses[i]);

           // goto page
           await scraper.doGo(TARGET_URL + urls[i]);
           console.log(`goto ${TARGET_URL + urls[i]}`);
 
           // get data
           for (let sl of selectorArray) {
             // acquired data
             const scrapedData: string = await scraper.doSingleEval(sl, 'textContent');
 
             // data exists
             if (scrapedData != '') {
               tmpArray.push(scrapedData);
             }
           }
 
           // push into final array
           resultArray.push(tmpArray);
        }

        // export csv
        const csvString: string = stringifySync(resultArray, {
          header: true, // header mode
          columns: headerObjArray,
        });

        // output csv file
        fs.writeFileSync(`output/${formattedDate}.csv`, csvString);

        // close window
        mainWindow.close();
      });

    } catch (err: unknown) {
      // error
      console.log(`error occured ${err}`);
    }

  });

  // closing
  mainWindow.on('closed', () => {
    // release window
    mainWindow = null;
  });

});

// choose csv data
const getCsvData = (): Promise<string[]>  => {
  return new Promise((resolve, reject) => {
    // show file dialog
    dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'], // file open
      title: 'choose csv file', // header title
      defaultPath: '.', // default path
      filters: [
        { name: 'csv(Shif-JIS)', extensions: ['csv'] }
      ],

    }).then((result: any) => {

      // file exists
      if (result.filePaths.length > 0) {
        // resolved
        resolve(result.filePaths);

      // no file
      } else {
        // rejected
        reject(result.canceled);
      }

    }).catch((err: unknown) => {
      // error
      console.log(`error occured ${err}`);
      // rejected
      reject(err);
    });
  });
}

// show dialog
const showDialog = (title: string, message: string, detail: any, flg:boolean = false):void => {
  try {
    // dialog options
    const options:DialogOptions = {
      type: '',
      title: title,
      message: message,
      detail: detail.toString(),
    };

    // error or not
    if (flg) {
      options.type = 'error';

    } else {
      options.type = 'info';
    }

    // show dialog
    dialog.showMessageBox(options);

  } catch (err: unknown) {
    // error
    console.log(`error occured ${err}`);
  };
}