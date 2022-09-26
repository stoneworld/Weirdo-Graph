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
    user.save()
  }
}
