const path = require("path")
const config = require(path.join(__dirname, "/config/config.js"))

const request = require("request")
const sizeOf = require("image-size")
const fs = require("fs")
let foo = require("foowrap")
let r = new foo(config)

let x = r.submissionStream({
    sub: ["gamescenery"],
    rate: 5000
})

const handledPostsPath = path.join(__dirname, "/handledPosts.json")
const handledPosts = fs.existsSync(handledPostsPath) ? require(handledPostsPath) : []

process.on("SIGINT", handleExit)
process.on("SIGUSR1", handleExit)
process.on("SIGUSR2", handleExit)
process.on("uncaughtException", handleExit)
process.on("exit", handleExit)


function handleExit () {
    // Save last 25 handled posts
    fs.writeFileSync(
        handledPostsPath,
        JSON.stringify(handledPosts.slice(-25))
    )
    process.exit()
}

x.on("post", handleSubmission)

const delayedComments = []
function handleSubmission(post) {
    if (handledPosts.includes(post.id))
        return

    if (post.post_hint !== "image")
        return
        
    console.log(`[${post.id}] Requesting ${post.url}`)
    request({url: post.url, encoding: null}, (error, response, buffer) => {
        if (error)
            return console.error(error)
        
        console.log(`[${post.id}] Calculating size`)
        var size = sizeOf(buffer)
        
        if (delayedComments.lenth)
            delayedComments.push({post, size})
        else comment({post, size})
    })

}

function comment({post, size}) {
    const splitTitle = post.title.split("]")
    let title = splitTitle[splitTitle.length-1].trim()

    if (!title)
        title = "Unnamed"
    
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
    .then(() => {
        console.log(`[${post.id}] Commented`)
        handledPosts.push(post.id)
        flair(post, size)
    })
    .catch(err => {
        if (err.message.startsWith("RATELIMIT")) {
            
            if (!delayedComments.includes({post, size}))
                delayedComments.push({post, size})

            const minutesLeft = err.message.substring(
                err.message.lastIndexOf("in ") + 3, 
                err.message.lastIndexOf(" minute")
            )
            console.log(`[${post.id}] Delayed (${minutesLeft}m)`)

            //try posting in x minutes + 1
            setTimeout(handleComments, (parseInt(minutesLeft)+1)*60*1000)

        }
        else console.error(`[${post.id}] Error commenting: ${err.message}`)
    })
}

function handleComments(){
    if (delayedComments.length) {
        delayedComment = delayedComments[0]
        comment(delayedComment).then(() => {
            delayedComments.shift()
            
            //Run again if more comments to handle
            if (delayedComments.length)
                handleComments()
        })
    }
}    

function flair(post, size) {
    post.assignFlair({text: `${size.width}x${size.height}`}).then(npost => {
        console.log(`[${post.id}] Assigned flair`)
    }).catch(err => {
        console.error(`[${post.id}] Error assigning flair: ${err.message}`)
    })
}
