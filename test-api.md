# 自动化测试 Gitee API

## 测试文件是否存在

```bash
curl -X GET "https://gitee.com/api/v5/repos/kuangquanshui73/cute-tasks-backup/contents/tasks.json" -H "Authorization: token a00af272eb277e9e3c980d45c321e6be"
```

## 测试创建文件

```bash
curl -X PUT "https://gitee.com/api/v5/repos/kuangquanshui73/cute-tasks-backup/contents/tasks.json" \
  -H "Authorization: token a00af272eb277e9e3c980d45c321e6be" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "eyJ0YXNrcyI6W3siaWQiOjEsInRpdGxlIjoi6ZmF6IKJ0ZXN05Y2Zp9Yj9mIn1dLCJ1c2VyRGF0YSI6eyJ0b3RhbFN0YXJzIjAsInN0cmVha0RheXMiOjAsInRvdGFsU3RhcnMiOjB9LCJsYXN0VXBkYXRlZCI6IjIwMjYtMDMtMjBUMDk6MDA6MDAuMDAwWiJ9",
    "message": "初始同步测试",
    "sha": null
  }'
```

## 测试更新文件

先获取 SHA，然后更新。

## 测试结果

请手动在浏览器中运行这些命令，或者使用 Postman 测试。
