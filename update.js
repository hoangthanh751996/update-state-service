const kue = require('kue');
const config = require('config');
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

let updateStatePage = async () => {
    const db = await MongoClient.connect(url);
    const dbo = await  db.db("adsbold-page");
    const pages = await dbo.collection("pages").find({is_crawling: true}).toArray();
    if(pages.length === 0 ){

    } else {
        let page_fb_ids = await getQueueActive();
        if(page_fb_ids.length === 0) {
            const query = { is_crawling: true};
            const diff = { $set: {is_crawling: false} };
            await dbo.collection("pages").updateMany(query, diff);
            console.log("UDPATE SUCCESS");
        } else {
            const pages = await dbo.collection("pages").find({is_crawling: true}).toArray();
            const pagesCrawling = pages.map(e => e.fb_id);
            const filterPages = pagesCrawling.filter(function(e) {
                return page_fb_ids.indexOf(e) === -1;
            });
            for(const page of filterPages) {
                const query = { fb_id: page};
                const diff = { $set: {is_crawling: false} };
                await dbo.collection("pages").updateOne(query, diff);
                console.log("UDPATE SUCCESS");
            }
        }
    }
    await db.close();
};

let getQueueActive = () => {
    let page_fb_ids = [];
    return new Promise(resolve => {
        kue.createQueue().active(async function( err, ids ) {
            if(err) return cb(true, err);
            for(const id of ids) {
                let title = await getJob(id);
                let str = title.split(" ");
                page_fb_ids = page_fb_ids.concat([str[str.length - 1]]);
            }
            return resolve(page_fb_ids);
        });
    })
};

let getJob = (id) => {
    return new Promise(resolve => {
        kue.Job.get( id,function( err, job ) {
            return resolve(job ? job.data.title : null);
        });
    })
};

let i = 0;
for( i = 0; i<100;i++) {
    setTimeout(function() {
        console.log("okmen");
        updateStatePage();
    }, 5000);
}

// process.exit(0);