import requests

url = "https://hook.eu2.make.com/tbauk9lt98qoan6cwbeiuu9yvh9nf8il"
payload = {
    "images": [
        "https://jpart.at/uploads/ig-1.jpg",
        "https://jpart.at/uploads/ig-2.jpg"
    ],
    "caption": "My new carousel 🎨"
}
r = requests.post(url, json=payload)
print(r.status_code, r.text)
