const config = require(require("path").join(__dirname, "/config/config.js"))

const request = require("request")
const sizeOf = require('image-size');
let foo = require("foowrap");
let r = new foo(config);

let x = r.submissionStream({
    sub: ["gamescenery", "testingground4bots"],
    rate: 5000
});

//x.on("post", handleSubmission);

r.getSubmission("e57hpp").fetch().then(handleSubmission)

function handleSubmission(post) {
    if (post.post_hint !== "image")
        return;
        
    console.log(`[${post.id}] Requesting ${post.url}`)
    request({url: post.url, encoding: null}, (error, response, buffer) => {
        if (error)
            return console.error(error)
        
        console.log(`[${post.id}] Calculating size`)
        var size = sizeOf(buffer)
        comment(post, size);
    })

}

const delayedComments = [];

function comment(post, size) {
    const splitTitle = post.title.split("]");
    const title = splitTitle[splitTitle.length-1];
    
    const replyText =
`
**${title}** by ${post.author.name}


Width | Height
:-: | :-:
${size.width} | ${size.height}


[download](${post.url})


^(I am a bot and this comment was created automatically)

`
    console.log(`[${post.id}] Posting comment`)
    return post.reply(replyText)
    .then(() => console.log(`[${post.id}] Commented`))
    .catch(err => {
        if (err.message.startsWith("RATELIMIT")) {
            if (!delayedComments.includes({post, size})) {
                delayedComments.push({post, size})
                const minutesLeft = err.message.substring(
                    err.message.lastIndexOf("in ") + 3, 
                    err.message.lastIndexOf(" minutes")
                );
                console.log(`[${post.id}] Delayed (${minutesLeft}m)`)
            }
        }
        else console.error(err)
    })
}

setInterval(() => {
    if (delayedComments.length) {
        delayedComment = delayedComments[0];
        comment(delayedComment.post, delayedComment.size).then(() => delayedComments.shift())
    }
}, 60000)