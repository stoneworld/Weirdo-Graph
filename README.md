# 使用 The Graph 构建具有过滤、排序、关系和全文搜索功能的 NFT API

## 背景
最近在参与一个项目，需要将用户拥有的某一个合约的 NFT 列表展示出来，我们都知道 ERC721 标准中并没有这么的一个接口，所以作为一个后端，第一反应是需要订阅 Transfer 事件，自行维护下 token owner (事实上The Graph也是如此)，但如果我们自己做的话，存在以下问题：

1. 我们需要一个 websocket 服务订阅事件日志，Alchemy 和 Infura 提供了类似的服务。
2. 我们需要服务器，后端脚本、数据库等整套后端服务去维护数据。
3. 保证订阅的稳定性以及自己服务的稳定性。

这些其实都是成本，于是放弃了这个方案。那还有没有其它方案呢，是不是有第三方 API 可用呢，[Alchemy](https://docs.alchemy.com/reference/getnfts) 提供了这个能力，但还是会存在一个问题，调用的时候发现其 QPS 是存在限制的，所以放弃了。后面朋友说一般都是是使用 The Graph，于是就花了点时间看了下。

## 什么是 The Graph

[The Graph](https://thegraph.com/docs/zh/about/) 的存在其实就是为了解决我上面提到的那些问题的，是一个去中心化的协议，根据用户定义的 subgraph 为以太坊数据建立索引，subgraph 描述定义了所关注的智能合约，这些合约中需要关注的事件，以及如何将事件数据映射到 The Graph 将存储在其数据库中的数据，整体流程如下：

1. 一个去中心化的应用程序通过智能合约上的交易向以太坊添加数据。
2. 智能合约在处理交易时，会发出一个或多个事件。
3. Graph 节点不断扫描以太坊的新区块和它们可能包含的子图的数据。
4. Graph 节点在这些区块中为你的子图找到 Ethereum 事件并运行你提供的映射处理程序。 映射是一个 WASM 模块，它创建或更新 Graph Node 存储的数据实体，以响应 Ethereum 事件。
5. 去中心化的应用程序使用节点的GraphQL 端点，从区块链的索引中查询 Graph 节点的数据。 Graph 节点反过来将 GraphQL 查询转化为对其底层数据存储的查询，以便利用存储的索引功能来获取这些数据。 去中心化的应用程序在一个丰富的用户界面中为终端用户显示这些数据，他们用这些数据在以太坊上发行新的交易。


## 构建 subgraph
### 前置条件

* 安装 node，我们会使用到 yarn 或者 npm
* 了解 GraphQL 
* 智能合约事件相关知识点

### 创建子图

https://thegraph.com/hosted-service/dashboard 打开这个地址，使用 github 登录后，会看到 Add Subgraph 

<img src=./imgs/WX20220926-151930@2x.png width=50% />

这里我们选择小幽灵合约作为示例如下，将必要的信息填写后如下：

<img src=./imgs/WX20220926-152353@2x.png width=50% />

随后系统会给出每一步的操作如下：

<img src=./imgs/WX20220926-152540@2x.png width=50% />


### 代码执行

```
npm install -g @graphprotocol/graph-cli
graph init --product hosted-service stoneworld/ghost
```

执行 graph init 可能因为某些原因会报错，所以这里我们自行从 https://etherscan.io/address/0x9401518f4ebba857baa879d9f76e1cc8b31ed197#code 合约这里将 Contract ABI 复制到一个文件中，指定文件路径。

<img src=./imgs/WX20220926-153221@2x.png width=50% />

因为这里我们使用的是小幽灵的合约，所以都是选择的是主网，根据你的实际情况进行选择。
进入到项目目录，以下几个文件是我们重点关注的：

* subgraph.yaml：包含子图清单的 YAML 文件。子图的主要配置和定义位于 **subgraph.yaml** 中。
* schema.graphql：一个 GraphQL 模式，它定义了为您的子图存储的数据，以及如何通过 GraphQL 查询它
* AssemblyScript Mappings：AssemblyScript 代码，可将以太坊中的事件数据转换为您的架构中定义的实体（例如本教程中的 src/weirdo.ts）


您将使用的subgraph.yaml中的条目是：

* dataSources.source：智能合约的地址、子图源以及您正在使用的智能合约的 ABI。地址是可选的；省略它允许索引来自所有合约的匹配事件。
* dataSources.source.startBlock（可选）：数据源开始索引的块的编号。在大多数情况下，我们建议使用创建合约的区块，否则索引器将从创世区块开始。
* dataSources.mapping.entities ：数据源写入存储的实体。每个实体的架构在 **schema.graphql** 文件中定义。
* dataSources.mapping.abis：源合约以及您在映射中与之交互的任何其他智能合约的一个或多个命名 ABI 文件。
* dataSources.mapping.eventHandlers：列出此子图响应的智能合约事件以及映射中的处理程序——示例中的 ./src/weirdo.ts——将这些事件转换为存储中的实体。

这里说下 startBlock 可以选择对应合约创建的区块开始，这样数据同步会更快点，我们可以从合约创建的这笔交易中拿到这个值。

<img src=./imgs/WX20220926-154140@2x.png width=50% />

schema.graphql 是定义实体(或者你常规理解的数据表) 的地方，这里定义如下：

```
type Token @entity {
  id: ID!
  tokenID: BigInt!
  tokenURI: String!
  ipfsURI: String!
  image: String!
  name: String!
  description: String!
  updatedAtTimestamp: BigInt!
  owner: User!
}

type User @entity {
  id: ID!
  tokens: [Token!]! @derivedFrom(field: "owner")
  tokenCount: Int //这里定义了一个 tokenCount 去维护某个地址的总的 token 数量
}

```

通过@derivedFrom 的关系：
可以通过@derivedFrom字段在实体上定义反向查找。这会在实体上创建一个可以查询但不能通过映射 API 手动设置的虚拟字段。相反，它是从在另一个实体上定义的关系派生的。对于这样的关系，将关系的两边都存储起来几乎没有什么意义，而且只存储一侧，导出另一侧时，索引和查询性能都会更好。

对于一对多关系，关系应始终存储在“一”端，而“多”端应始终派生。以这种方式存储关系，而不是在“多”端存储实体数组，将大大提高索引和查询子图的性能。通常，应尽可能避免存储实体数组。

### 代码生成

接下来运行以下命令：

```
graph codegen
```

为了使智能合约、事件和实体的工作变得简单且类型安全，Graph CLI从子图的 GraphQL 模式和数据源中包含的合约 ABI 的组合中生成AssemblyScript类型，执行后会更新一个 generated 目录下的代码。


### 使用实体和映射更新子图

现在您可以更新subgraph.yaml中的主要配置以使用您刚刚创建的实体并配置它们的映射:

```
specVersion: 0.0.4
schema:
  file: ./schema.graphql
features:
  - fullTextSearch
  - ipfsOnEthereumContracts
dataSources:
  - kind: ethereum
    name: weirdo
    network: mainnet
    source:
      address: "0x9401518f4ebba857baa879d9f76e1cc8b31ed197"
      abi: weirdo
      startBlock: 14171042
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.6
      language: wasm/assemblyscript
      entities:
        - Token
        - Owner
      abis:
        - name: weirdo
          file: ./abis/weirdo.json
      eventHandlers:
        - event: Transfer(indexed address,indexed address,indexed uint256)
          handler: handleTransfer
      file: ./src/weirdo.ts

```

为此，我们这里更新dataSources.mapping.entities字段 以及 eventHandlers 和 features，如果你用到了ipfs.cat 需要加上 ipfsOnEthereumContracts 不然会报错。

### AssemblyScript 脚本编写

打开 `src/weirdo` 文件，handleTransfer 函数其实和 subgraph.yaml eventHandlers 处理这里是映射起来的，这个函数进行 Transfer 事件的接收处理，整体代码示例如下：

```
import { BigInt, ipfs, json } from "@graphprotocol/graph-ts"
import {
  weirdo,
  Approval,
  ApprovalForAll,
  OwnershipTransferred,
  PaymentReleased,
  Transfer
} from "../generated/weirdo/weirdo"
import { Token, User } from "../generated/schema"

const ipfs_hash = "QmU61BwmB9fm3kN4EWS14YxrB1FFJcMWj9GRrf4hsEvaYE"

export function handleTransfer(event: Transfer): void {
  /* 从 Graph Node 中加载 Token 数据，你可以理解为从 MysQL 中根据 TokenId 查询数据 */
  let token = Token.load(event.params.tokenId.toString())
  if (!token) {
    /* 如何 token 不存在，这里将新建一个 */
    token = new Token(event.params.tokenId.toString())
    token.tokenID = event.params.tokenId
    // https://ipfs.io/ipfs/QmU61BwmB9fm3kN4EWS14YxrB1FFJcMWj9GRrf4hsEvaYE/1
    token.tokenURI = "/" + event.params.tokenId.toString()

    /* combine the ipfs hash and the token ID to fetch the token metadata from IPFS */
    let metadata = ipfs.cat(ipfs_hash + token.tokenURI)

    if (metadata) {
      const value = json.fromBytes(metadata).toObject()
      if (value) {
        const image = value.get('image')
        const name = value.get('name')
        const description = value.get('description')

        if (name && image && description) {
          token.name = name.toString()
          token.image = image.toString()
          token.description = description.toString()
          token.ipfsURI = 'ipfs.io/ipfs/' + ipfs_hash + token.tokenURI
        }
      }
    }
  }

  token.updatedAtTimestamp = event.block.timestamp

  /* 设置或者更新 token owner 字段并将数据更新到 Graph Node */
  token.owner = event.params.to.toHexString()
  token.save()

  /* 如果用户不存在，则创建一个 */
  let user = User.load(event.params.to.toHexString())
  if (!user) {
    user = new User(event.params.to.toHexString())
    user.tokenCount = 0
    user.save()
  }
  let fromUser = User.load(event.params.from.toHexString())
  if (fromUser) {
    // 转移来源的 tokenCount - 1
    fromUser.tokenCount = fromUser.tokenCount - 1
    fromUser.save()
  }

  user.tokenCount = user.tokenCount + 1
  user.save()
}

```

### 部署子图

如图依次执行：

```
graph auth
graph deploy
```

打开服务面板这里可以看到同步进度：

<img src=./imgs/WX20220926-161135@2x.png width=50% />

这个时候我们就可以查询相关数据了，查询语句如下：

```
// 查询某一个id信息
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
// 查询某一个用户拥有的 token 列表 以及 数量
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
当然也可以直接通过 https 的形式进行访问了，拿到 QUERIES (HTTP) 访问如下：

```
curl --location --request POST 'https://api.thegraph.com/subgraphs/name/stoneworld/weirdo' \
--header 'Content-Type: application/json' \
--data-raw '{"query":"{\n  users(where: {\n    id: \"0x8a8fcbeacedd7aa304ea06ce605d525a4a218b9d\"\n  }) {\n    id\n    tokens {\n      id\n    }\n    tokenCount\n  }\n}","variables":{}}'
```

<img src=./imgs/WX20220926-162114@2x.png width=50% />


至此整个流程就结束了，整个示例代码我放到了 [github](https://github.com/stoneworld/Weirdo-Graph) 