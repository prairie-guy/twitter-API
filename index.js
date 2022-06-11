const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

require('dotenv').config();

// Pass `handle` as a commandline
const argv = process.argv.slice(2)

console.log(argv)

var handle_in = argv[0];
var total_tweets_in =argv[1];
// const handle = 'barackobama';
// const total_tweets = 10;

async function run(handle,total_tweets) {
    const browser = await puppeteer.launch({
        headless: true
    })
    const page = await browser.newPage()

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36')

    await page.goto(`https://twitter.com/search?q=from%3A${handle}%20since%3A2006-03-21&src=typed_query&f=live`, { waitUntil: 'networkidle2' });
    await page.setViewport({ width: 1280, height: 800 });


    await page.waitForSelector('article')


    var tweets_obj = {
        tweets: []
    }
    var tweet_ids = []


    var i=1

    async function getTweets() {
        let bodyHTML = await page.evaluate(() => document.body.innerHTML);
        let $ = cheerio.load(bodyHTML)
        let all_tweets = $(bodyHTML).find('[data-testid="primaryColumn"] section > div > div > div')
        let tweets = []
        all_tweets.each(async function (ii) {
            // don't allow duplicates
            let id = Number($(this).attr('style').split(' ').at(1).replace('translateY(', '').replace('px);', ''))
            if (!tweet_ids.includes(id) && tweets_obj.tweets.length + tweets.length < total_tweets) {
                let text = $(this).find('[data-testid="tweetText"]').eq(0).text()
                let date = $(this).find('time').attr('datetime')
                if (date === undefined) {
                    page.evaluate((iii) => {
                        console.log(iii)
                    }, ii)
                }
                metadata = {
                    handle,
                    text,
                    date,
                    id
                }
                tweets.push(metadata)
                console.log(i)
                i++
            }
        })
        return tweets
    }
    function getTweetsAndScroll() {
        getTweets().then(async (tweets) => {
            tweets.forEach((t) => {
                // what user sees
                tweets_obj.tweets.push({
                    handle: t.handle,
                    text: t.text,
                    date: t.date
                })
                // add to exclusion array
                tweet_ids.push(t.id)
            })
            if (tweets_obj.tweets.length < total_tweets) {
                var currentHTML = ''
                await page.evaluate(() => {
                    document.querySelector('[data-testid="primaryColumn"] section > div > div > div:last-child').scrollIntoView()
                    currentHTML = document.querySelector('[data-testid="primaryColumn"] section > div > div').innerHTML
                })
                await page.waitForFunction(`document.querySelector('[data-testid="primaryColumn"] section > div > div').innerHTML != currentHTML`, { timeout: 5000 }).catch(() => { console.log('timeout') })
                await page.waitForFunction(`Array.from(document.querySelectorAll('[data-testid="primaryColumn"] section > div > div > div')).map(e => Number(e.getAttribute('style').split(' ').at(1).replace('translateY(', '').replace('px);', ''))).includes(${tweet_ids.at(-1)})`, { timeout: 5000 }).catch(() => { console.log('timeout') })
                await getTweetsAndScroll()
            }
            else {
                const csvWriter = createCsvWriter({
                    path: `${handle}.csv`,
                    header: [
                        { id: 'handle' , title: 'handle' },
                        { id: 'text'   , title: 'text' },
                        { id: 'date'   , title: 'date' },
                    ]
                });
                const data = tweets_obj.tweets
                //console.log(data)
                csvWriter
                    .writeRecords(data)
                    .then(() => console.log('The CSV file was written successfully'));

            }
        })
    }
    getTweetsAndScroll()

}


run(handle_in,total_tweets_in)


