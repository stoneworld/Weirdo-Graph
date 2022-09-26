







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
    id: "0x8a8fcbeacedd7aa304ea06ce605d525a4a218b9d"
  }) {
    id
    tokens {
      id
    }
    tokenCount
  }
}
```
graph codegen

graph build

graph auth --product hosted-service auth_token

graph deploy --product hosted-service stoneworld/weirdo
