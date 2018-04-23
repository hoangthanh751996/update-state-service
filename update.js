const kue = require('kue');
const config = require('config');
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

let updateStatePage = (async () => {
  const db = await MongoClient.connect(url);
  const dbo = await  db.db("adsbold-page");
  const pages = await dbo.collection("pages").find({is_crawling: true}).toArray();
  if (pages.length === 0) {
    console.log("Don't have pages be crawling");
  } else {
    try {
      let active_page_fb_ids = await getQueueActive();
      let inactive_page_fb_ids = await getQueueInactive();
      if (active_page_fb_ids.length === 0 && inactive_page_fb_ids.length === 0) {
        const query = {is_crawling: true};
        const diff = {$set: {is_crawling: false}};
        await dbo.collection("pages").updateMany(query, diff);
        console.log("UPDATE PAGES SUCCESS");
      } else if (inactive_page_fb_ids.length === 0) {
        const pages = await dbo.collection("pages").find({is_crawling: true}).toArray();
        const pagesCrawling = pages.map(e => e.fb_id);
        const filterPages = pagesCrawling.filter(function (e) {
          return active_page_fb_ids.indexOf(e) === -1;
        });
        for (const page of filterPages) {
          const query = {fb_id: page};
          const diff = {$set: {is_crawling: false}};
          await dbo.collection("pages").updateOne(query, diff);
          console.log("UPDATE PAGES SUCCESS");
        }
      } else {
        const pages = await dbo.collection('pages').find({is_crawling: true}).toArray();
        const pagesCrawling = pages.map(e => e.fb_id);
        const pagesInactiveFilter = pagesCrawling.filter(e => inactive_page_fb_ids.indexOf(e) === -1);
        const pagesActiveFilter = pagesInactiveFilter.filter(e => active_page_fb_ids.indexOf(e) === -1);

        for (const page of pagesActiveFilter) {
          const query = {fb_id: page};
          const diff = {
            $set: {
              is_crawling: false
            }
          };
          await dbo.collection('pages').updateOne(query, diff);
          console.log('Update pages success');
        }
      }
    } catch (err) {
      console.log('Update state page error', err);
    }
  }
  await db.close();
  process.exit(0);
})();

let getQueueActive = () => {
  let page_fb_ids = [];
  return new Promise((resolve, reject) => {
    kue.createQueue().active(async (err, ids) => {
      if (err) return reject(err);
      for (const id of ids) {
        try {
          let title = await getJob(id);
          let str = title.split(" ");
          page_fb_ids = page_fb_ids.concat([str[str.length - 1]]);
        } catch (err) {
          return reject(err);
        }
      }
      return resolve(page_fb_ids);
    });
  });
};

let getQueueInactive = () => {
  let page_fb_ids = [];
  return new Promise((resolve, reject) => {
    kue.createQueue().inactive(async (err, ids) => {
      if (err) return reject(err);
      for(const id of ids) {
        try {
          let title = await getJob(id);
          let str = title.split(' ');
          page_fb_ids = page_fb_ids.concat([str[str.length - 1]]);
        } catch (err) {
          return reject(err);
        }
      }
      return resolve(page_fb_ids);
    });
  });
};

let getJob = (id) => {
  return new Promise((resolve, reject) => {
    kue.Job.get(id, (err, job) => {
      if(err) return reject(err);
      return resolve(job ? job.data.title : null);
    });
  })
};

