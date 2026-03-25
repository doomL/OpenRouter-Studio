[Skip to content](https://openrouter.notion.site/video-generation-testing#main)

![](https://openrouter.notion.site/image/attachment%3A5f9dbd71-5636-4d56-a16c-89ba44b24c34%3Amedia-playground-1774038841405.png?table=block&id=3282fd57-c4dc-80a5-858d-e2672dffd10f&spaceId=3ca2dde7-b06f-4c41-8d77-2aa5e789af62&width=2000&userId=&cache=v2)

![📹 Page icon](<Base64-Image-Removed>)![📹 Page icon](https://notion-emojis.s3-us-west-2.amazonaws.com/prod/svg-twitter/1f4f9.svg)

# OpenRouter Video Generation Alpha

## Welcome

Thank you for being one of the first to try video generation on OpenRouter. We're opening this new API to only a small group prior to the public launch to gather feedback.

What we need from you:

Try the API with realistic workloads. We support text-to-video and image-to-video.

Tell us what breaks, confuses, or feels wrong about the API. We'll lock it down at the public launch, so now is the time to speak up.

We expect this experimental period to run 1-2 weeks. Everything here is subject to change.

If you know someone who wants to try this out, send them the [signup form](https://openrouter.notion.site/3282fd57c4dc80aba183f5024e233e74?pvs=105), and we’ll invite them.

## Questions & Feedback

We’re eager to hear what you think! Drop any feedback, positive or negative, in [#video-feedback](https://discord.com/channels/1091220969173028894/1485734495683612833) on Discord. If you haven’t signed up for [our Discord yet, go here](https://discord.gg/openrouter).

We’d prefer to use Discord to share all feedback, but if that’s not an option, you can email feedback to [product@openrouter.ai](mailto:product@openrouter.ai)

## Known Limitations

No SDK support (coming at public launch)

Video generations may display incorrectly in the Logs UI

Model pages and pricing displays on the website are not available

No cancel or delete endpoints

## Billing & Credits

Billing is live during the alpha so we can test the full payment flow. If a generation fails or behaves unexpectedly, drop a note in #video-feedback and we'll credit you back. We also have promo credits set aside for testers who help us find and fix issues.

When you submit a generation, credits are placed on hold based on an estimated cost. When the generation is complete, the hold is removed, and the actual charge is applied. If the generation fails, the hold is released.

You may see held credits affect your available balance for other API calls. This is expected. In the public release we will show this balance in the UI.

## Available Models

Our docs are still in progress, so you’ll need to reference the models providers for details:

Google Veo 3.1 (

google/veo-3.1

)

[Model capabilities](https://ai.google.dev/gemini-api/docs/video) · [Pricing](https://ai.google.dev/gemini-api/docs/pricing#veo-3.1)

OpenAI Sora 2 (

openai/sora-2-pro

)

[Model capabilities](https://developers.openai.com/api/docs/guides/video-generation/) · [Pricing](https://openai.com/api/pricing/)

ByteDance Seedance 1.5 Pro (

bytedance/seedance-1-5-pro

)

[Model capabilities](https://docs.byteplus.com/en/docs/ModelArk/1366799) · [Pricing](https://docs.byteplus.com/en/docs/ModelArk/1544106)

## API Spec

![⚠️ Callout icon](<Base64-Image-Removed>)

This API spec may change. Based on your feedback, we may add/remove/change any part of this spec. We will move it to the

v1

API once it is finalized.

Video generation is async. You submit a generation request, get a job ID back immediately, then poll for the result.

### Step 1: Submit a generation request

POST /api/alpha/videos

{"model":"google/veo-3.1","prompt":"A teddy bear playing electric guitar on stage at a concert","aspect\_ratio":"16:9","duration":4,"resolution":"1080p","size":"1920x1080","generate\_audio":true,"seed":42,"input\_references":\[{"type":"image\_url","image\_url":{"url":"https://..."}}\]}

​

#### Request fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| model | string | Yes | Model slug (e.g. <br>google/veo-3.1<br>, <br>openai/sora-2-pro<br>) |
| prompt | string | Yes | Text description of the desired video |
| duration | integer | No | Desired duration in seconds (model-dependent) |
| resolution | string | No | 480p<br>, <br>720p<br>, <br>1080p<br>, <br>1K<br>, <br>2K<br>, <br>4K<br>. Can be combined with <br>aspect\_ratio<br>. If omitted, the provider's default is used. Cannot be combined with <br>size<br>. |
| aspect\_ratio | string | No | e.g. <br>16:9<br>, <br>9:16<br>, <br>1:1<br>. Can be combined with <br>resolution<br>. If omitted, the provider's default is used. Cannot be combined with <br>size<br>. |
| size | string | No | Explicit dimensions (e.g. <br>1280x720<br>). Use this as an alternative to <br>resolution<br>• <br>aspect\_ratio<br>. Cannot be combined with <br>resolution<br>or <br>aspect\_ratio<br>; the API will return an error on conflict. |
| input\_references | array | No | Array of image content parts for image-to-video (see Image-to-Video below). Most providers only support 1-2 references; the API returns an error if you exceed the provider's limit. |
| generate\_audio | boolean | No | Co-generate audio (model-dependent, e.g. Veo 3.1) |
| seed | integer | No | For reproducible generations |

#### Supported Parameters by Model

Pricing changes based on these parameters. Check on the

| Parameter | Veo 3.1 | Sora 2 Pro | Seedance 1.5 Pro |
| --- | --- | --- | --- |
| duration | 4s, 6s, or 8s | 4s, 8s, 12s, 16s, or 20s | 4–12s |
| resolution | 720p<br>, <br>1080p<br>, <br>4K | 720p<br>, <br>1080p | 480p<br>, <br>720p<br>, <br>1080p |
| aspect\_ratio | 16:9<br>, <br>9:16 | 16:9<br>, <br>9:16 | 16:9<br>, <br>9:16<br>, <br>4:3<br>, <br>3:4<br>, <br>1:1<br>, <br>21:9 |
| input\_references | 1 image (i2v), up to 3 reference images | 1 image | 1–2 images (first/last frame) |
| generate\_audio | Yes | Yes | Yes |

#### Response (HTTP 202)

{"id":"vgen\_abc123def456","polling\_url":"https://openrouter.ai/api/alpha/videos/vgen\_abc123def456","status":"pending"}

​

Credits are placed on hold using an estimated cost when the job is created. The hold is finalized into an actual charge when the generation completes, or released if it fails.

### Step 2: Poll for status

GET /api/alpha/videos/:jobId

Poll this endpoint until

status

is

completed

or

failed

. We recommend polling every 30 seconds. The response uses the same schema as the creation response, with fields progressively populated.

#### Response (completed)

{"id":"vgen\_abc123def456","polling\_url":"https://openrouter.ai/api/alpha/videos/vgen\_abc123def456","status":"completed","unsigned\_urls":\["https://openrouter.ai/api/alpha/videos/vgen\_abc123def456/content?index=0"\],"usage":{"cost":3.2,"is\_byok":false},"generation\_id":"gen-vid-...."}

​

#### Response (failed)

{"id":"vgen\_abc123def456","polling\_url":"https://openrouter.ai/api/alpha/videos/vgen\_abc123def456","status":"failed","error":"Content moderation: prompt was flagged"}

​

#### Statuses

| Status | Meaning |
| --- | --- |
| pending | Job accepted, queued for processing |
| in\_progress | Generation in progress |
| completed | Done. <br>unsigned\_urls<br>array is populated. |
| failed | Something went wrong. Check <br>error<br>. |
| cancelled | Job was cancelled. |
| expired | Job expired before completing. |

### Step 3: Download the video

GET /api/alpha/videos/:jobId/content

Returns the raw video bytes (MP4).

![⏳ Callout icon](<Base64-Image-Removed>)

Video URLs are temporary. Upstream providers expire generated videos within 1-48 hours depending on the model. Download and persist videos to your own storage promptly.

### Image-to-Video

Pass image references via

input\_references

to use an image as input:

{"model":"google/veo-3.1","prompt":"The scene comes to life with gentle motion","input\_references":\[{"type":"image\_url","image\_url":{"url":"https://example.com/my-image.jpg"}}\]}

​

input\_references

accepts the same image content part format used in chat completions (HTTPS URLs and base64 data URIs both work).

### Quick Start Example (curl)

\# 1\. Submit a generationcurl -X POST https://openrouter.ai/api/alpha/videos \
 -H "Authorization: Bearer $OPENROUTER\_API\_KEY"\
 -H "Content-Type: application/json"\
 -d '{
"model": "google/veo-3.1",
"prompt": "A cat walking across a sunny windowsill",
"duration": 4
}'\# 2\. Poll for status (replace JOB\_ID with the id from step 1)curl https://openrouter.ai/api/alpha/videos/JOB\_ID \
 -H "Authorization: Bearer $OPENROUTER\_API\_KEY"\# 3\. Download the first video (index = 0) when status is "completed"curl https://openrouter.ai/api/alpha/videos/JOB\_ID/content?index=0\
 -H "Authorization: Bearer $OPENROUTER\_API\_KEY"\
 -o output.mp4

​

### Quick Start Example (JavaScript)

constOPENROUTER\_API\_KEY= process.env.OPENROUTER\_API\_KEY;constBASE='https://openrouter.ai/api/alpha/videos';// 1\. Submitconst create =awaitfetch(BASE,{method:'POST',headers:{'Authorization':\`Bearer ${OPENROUTER\_API\_KEY}\`,'Content-Type':'application/json',},body:JSON.stringify({model:'google/veo-3.1',prompt:'A cat walking across a sunny windowsill',duration:4,}),});const{ id }=await create.json();// 2\. Polllet status ='pending';while(status !=='completed'&& status !=='failed'){awaitnewPromise(r=>setTimeout(r,30000));const poll =awaitfetch(\`${BASE}/${id}\`,{headers:{'Authorization':\`Bearer ${OPENROUTER\_API\_KEY}\`},});const job =await poll.json();
status = job.status;if(status ==='completed'){
console.log('Video URL:', job.unsigned\_urls\[0\]);}if(status ==='failed'){
console.error('Failed:', job.error);}}

​

### Quick Start Example (Python)

import requests, time, os

API\_KEY = os.environ\["OPENROUTER\_API\_KEY"\]
BASE ="https://openrouter.ai/api/alpha/videos"
HEADERS ={"Authorization":f"Bearer {API\_KEY}"}\# 1\. Submit
resp = requests.post(BASE, headers=HEADERS, json={"model":"google/veo-3.1","prompt":"A cat walking across a sunny windowsill","duration":4,})
job\_id = resp.json()\["id"\]\# 2\. PollwhileTrue:
time.sleep(30)
status\_resp = requests.get(f"{BASE}/{job\_id}", headers=HEADERS)
job = status\_resp.json()if job\["status"\]=="completed":print("Video URL:", job\["unsigned\_urls"\]\[0\])breakif job\["status"\]=="failed":print("Failed:", job\["error"\])break

​