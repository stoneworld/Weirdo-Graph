







查询某一个：

```
{
  tokens(where: {
    tokenID: "2460"
  }) {
    id
    tokenID
    tokenURI
    ipfsURI
    owner {
      id
    }
    updatedAtTimestamp
  }
}

{
  users(where: {
    id: "0x36a0fb042134e3af1fb2b1c5ff0bdf4564dec057"
  }) {
    id
    tokens {
      id
    }
  }
}
```