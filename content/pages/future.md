---
title: "Future"
slug: future
---

Writing about what is coming — AI, the future, and what it means to stay human.

{% for post in collections.future | reverse %}
- [{{ post.data.title }}]({{ post.url }}) — {{ post.date | readableDate }}
{% endfor %}
