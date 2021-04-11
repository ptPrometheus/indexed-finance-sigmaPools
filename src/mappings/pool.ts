import { Address, ethereum, BigInt, BigDecimal, log, Bytes } from "@graphprotocol/graph-ts";
import {
    SigmaControllerV1,
    PoolInitialized,
    TokenAdded,
    TokenRemoved,
    TokenListAdded,
    TokenListSorted
  } from "../../generated/SigmaControllerV1/SigmaControllerV1";

import {
  SigmaIndexPoolV1,
} from "../../generated/templates"


//Entitys
import { IndexPool, UnderlyingTokens, Token, Swap, HourlyPoolSnapshot, Lists, ListManager} from "../../generated/schema";

//Pool Events
import { LOG_DENORM_UPDATED, LOG_DESIRED_DENORM_SET, LOG_SWAP, LOG_JOIN, LOG_EXIT, Transfer, LOG_TOKEN_REMOVED, LOG_TOKEN_ADDED, LOG_TOKEN_READY, LOG_MINIMUM_BALANCE_UPDATED, LOG_MAX_TOKENS_UPDATED, LOG_SWAP_FEE_UPDATED } from "../../generated/templates/SigmaIndexPoolV1/SigmaIndexPoolV1"
import { SigmaIndexPoolV1 as PoolContract} from "../../generated/templates/SigmaIndexPoolV1/SigmaIndexPoolV1";

//Helpers
import { convertEthToDecimal, hexToDecimal, joinHyphen, ZERO_BI } from "../helpers/general";
import { getTokenPriceUSD } from "../helpers/pricing";
import { convertTokenToDecimal, ZERO_BD } from "../helpers/general";
import { ADDRESS_ZERO } from '../helpers/uniswap';
import { fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from '../helpers/uniswap';
import { getListManager } from '../helpers/categories';



function loadUnderlyingToken(poolAddress: Address, tokenAddress: Address): UnderlyingTokens {
  let tokenID = joinHyphen([poolAddress.toHexString(), tokenAddress.toHexString()]);
  return UnderlyingTokens.load(tokenID) as UnderlyingTokens;
}



function updateTokenPrices(pool: IndexPool): void {
  let tokenAddresses = pool.tokensList;
  for (let i = 0; i < tokenAddresses.length; i++) {
    let tokenAddress = tokenAddresses[i]
    let token = Token.load(tokenAddress.toHexString()) as Token
    token.priceUSD = getTokenPriceUSD(token)
    token.save()
  }
}

/*function updateDailySnapshot(pool: IndexPool, event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 86400;
  let poolDayID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString());
  let snapshot = DailyPoolSnapshot.load(poolDayID);
  if (snapshot == null) {
    snapshot = new DailyPoolSnapshot(poolDayID);
  }

  snapshot.pool = event.address.toHexString();
  snapshot.date = dayID * 86400;

  let underlyingTokens = pool.tokens;
  let tokenAddresses = pool.tokensList;
  let balances = new Array<BigInt>()
  let denorms = new Array<BigInt>()
  let desiredDenorms = new Array<BigInt>()
  let tokens = new Array<Bytes>()
  let totalValueLockedUSD = ZERO_BD

  for (let i = 0; i < tokenAddresses.length; i++) {
    let tokenAddress = tokenAddresses[i]
    let poolToken = loadUnderlyingToken(Address.fromString(pool.id), tokenAddress as Address) as UnderlyingTokens
    balances.push(poolToken.balance)
    denorms.push(poolToken.denorm)
    desiredDenorms.push(poolToken.desiredDenorm)
    tokens.push(tokenAddress)
    let token = Token.load(tokenAddress.toHexString())
    let balance = convertTokenToDecimal(poolToken.balance, token.decimals)
    let value = balance.times(token.priceUSD)
    totalValueLockedUSD = totalValueLockedUSD.plus(value)
  }
  snapshot.balances = balances;
  snapshot.denorms = denorms;
  snapshot.desiredDenorms = desiredDenorms;
  snapshot.tokens = tokens;

  pool.totalValueLockedUSD = totalValueLockedUSD
  pool.save()
  let totalSupply = convertEthToDecimal(pool.totalSupply);
  let value = totalValueLockedUSD.div(totalSupply);
  snapshot.value = value;
  snapshot.totalSupply = totalSupply
  snapshot.feesTotalUSD = pool.feesTotalUSD
  snapshot.totalValueLockedUSD = pool.totalValueLockedUSD
  snapshot.totalSwapVolumeUSD = pool.totalSwapVolumeUSD
  snapshot.totalVolumeUSD = pool.totalVolumeUSD
  snapshot.save();
}*/

function updateHourelySnapshot(pool: IndexPool, event: ethereum.Event): void {
  let timestamp = event.block.timestamp.toI32();
  let dayID = timestamp / 3600;
  let poolDayID = event.address.toHexString().concat('-').concat(BigInt.fromI32(dayID).toString());
  let snapshot = HourlyPoolSnapshot.load(poolDayID);
  if (snapshot == null) {
    snapshot = new HourlyPoolSnapshot
    (poolDayID);
  }
  snapshot.hour = BigInt.fromI32(dayID);
  snapshot.pool = event.address.toHexString();
  snapshot.date = dayID * 3600;
  snapshot.blockNumber = event.block.number;


  let tokenAddresses = pool.tokensList;
  let balances = new Array<BigInt>()
  let denorms = new Array<BigInt>()
  let desiredDenorms = new Array<BigInt>()
  let tokens = new Array<Bytes>()
  let totalValueLockedUSD = ZERO_BD

  for (let i = 0; i < tokenAddresses.length; i++) {
    let tokenAddress = tokenAddresses[i]
    let poolToken = loadUnderlyingToken(Address.fromString(pool.id), tokenAddress as Address) as UnderlyingTokens
    balances.push(poolToken.balance)
    denorms.push(poolToken.denorm)
    desiredDenorms.push(poolToken.desiredDenorm)
    tokens.push(tokenAddress)
    let token = Token.load(tokenAddress.toHexString())
    let balance = convertTokenToDecimal(poolToken.balance, token.decimals)
    let value = balance.times(token.priceUSD)
    totalValueLockedUSD = totalValueLockedUSD.plus(value)
  }
  snapshot.balances = balances;
  snapshot.denorms = denorms;
  snapshot.desiredDenorms = desiredDenorms;
  snapshot.tokens = tokens;

  pool.totalValueLockedUSD = totalValueLockedUSD
  pool.save()
  let totalSupply = convertEthToDecimal(pool.totalSupply);
  let value = totalValueLockedUSD.div(totalSupply);
  snapshot.value = value;
  snapshot.totalSupply = totalSupply
  snapshot.feesTotalUSD = pool.feesTotalUSD
  snapshot.totalValueLockedUSD = pool.totalValueLockedUSD
  snapshot.totalSwapVolumeUSD = pool.totalSwapVolumeUSD
  snapshot.totalVolumeUSD = pool.totalVolumeUSD
  snapshot.save();
}




//####################################-----Controller-Contract-----##########################################################

export function handleTokenListAdded(event: TokenListAdded): void {
  let listManager = getListManager();
  listManager.categoryIndex++;
  listManager.save();
  let list = new Lists(event.params.listID.toHexString());
  list.metadataHash = event.params.metadataHash;
  list.tokens = [];
  list.minimumScore = event.params.minimumScore;
  list.maximumScore = event.params.maximumScore;
  list.scoringStrategy = event.params.scoringStrategy;
  list.save();
}

export function handleTokenAdded(event: TokenAdded): void {
  event.params.listID
  let listID = event.params.listID.toHexString();
  let tokenAddress = event.params.token.toHexString();
  let list = Lists.load(listID);
  let token = Token.load(tokenAddress);
  if (token == null) {
    token = new Token(tokenAddress);
    token.decimals = fetchTokenDecimals(event.params.token);
    token.name = fetchTokenName(event.params.token);
    token.symbol = fetchTokenSymbol(event.params.token);
    token.priceUSD = getTokenPriceUSD(token as Token)
    token.save();
  }
  if (list.tokens == null) list.tokens = [];
  list.tokens.push(tokenAddress);
  list.save();
}

export function handleTokenRemoved(event: TokenRemoved): void {
  let listID = event.params.listID.toHexString();
  let tokenAddress = event.params.token.toHexString();
  let list = Lists.load(listID);
  let tokensList = new Array<string>();
  let listTokens = list.tokens;
  for (let i = 0; i < listTokens.length; i++) {
    let token = listTokens[i];
    if (token.toString() != tokenAddress) {
      tokensList.push(token);
    }
  }
  list.tokens = tokensList;
  list.save();
}


//Kann noch ausgefüllt werden

/*export function handlelistSorted(event: listSorted): void {
  let list = list.load(event.params.listID.toHexString());
  let oracle = MarketCapSqrtController.bind(event.address);
  let tokens = oracle.getlistTokens(event.params.listID);
  let arr: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    arr.push(tokens[i].toHexString());
  }
  list.tokens = arr;
  list.save();
}*/

export function handlePoolInitialized(event: PoolInitialized): void {

  let id = event.params.pool.toHexString();
  let pool = new IndexPool(id);

  pool.undboundTokenSellerAddress = event.params.unboundTokenSeller;
  pool.size = event.params.indexSize
  let listID = event.params.listID.toHexString();

  let poolAddress = event.params.pool;
  SigmaIndexPoolV1.create(poolAddress);

  /*let listManager = getListManager();
  let poolsList = listManager.poolsList;
  poolsList.push(poolAddress.toHexString());
  listManager.poolsList = poolsList;
  listManager.save();*/

  
  //#bind Contract and use Getters
  let contract = PoolContract.bind(poolAddress);
  let swapFee = contract.getSwapFee()
  pool.swapFee = hexToDecimal(swapFee.toHexString(), 16);
  pool.name = contract.name();
  pool.symbol = contract.symbol();
  pool.totalWeight = contract.getTotalDenormalizedWeight();
  pool.totalSupply = contract.totalSupply();
  pool.maxTotalSupply = new BigInt(0);
  pool.feesTotalUSD = ZERO_BD;
  pool.totalValueLockedUSD = ZERO_BD;
  pool.totalSwapVolumeUSD = ZERO_BD;
  pool.totalVolumeUSD = ZERO_BD;
  pool.list = listID;

  //Push Tokens to Pool enetity and fill ot underlying Token entity
  let tokensList = new Array<Bytes>()
  let tokens = contract.getCurrentTokens();
  for (let i = 0; i < tokens.length; i++) {
    let tokenAddress = tokens[i];
    let record = contract.getTokenRecord(tokenAddress);
    let tokenID = poolAddress.toHexString().concat('-').concat(tokenAddress.toHexString());
    let token = new UnderlyingTokens(tokenID);
    token.token = tokenAddress.toHexString();
    token.denorm = record.denorm;
    token.ready = true;
    token.desiredDenorm = record.desiredDenorm;
    token.balance = record.balance;
    token.pool = poolAddress.toHexString();
    token.save();
    tokensList.push(tokenAddress) 
  }
  pool.tokensList = tokensList;
  pool.save();
}

export function handleSwap(event: LOG_SWAP): void {
  let poolTokenIn = loadUnderlyingToken(event.address, event.params.tokenIn);
  let poolTokenOut = loadUnderlyingToken(event.address, event.params.tokenOut);
  poolTokenIn.balance = poolTokenIn.balance.plus(event.params.tokenAmountIn);
  poolTokenOut.balance = poolTokenOut.balance.minus(event.params.tokenAmountOut);
  poolTokenIn.save();
  poolTokenOut.save();

  let pool = IndexPool.load(event.address.toHexString())
  if (pool == null) {
    log.error('Pool was null!', [])
  }
  updateTokenPrices(pool as IndexPool)

  let tokenOut = Token.load(poolTokenOut.token)
  let tokenAmountOutDecimal = convertTokenToDecimal(event.params.tokenAmountOut, tokenOut.decimals)
  let swapValue = tokenAmountOutDecimal.times(tokenOut.priceUSD)
  let swapFeeValue = swapValue.times(pool.swapFee)

  updateHourelySnapshot(pool as IndexPool, event);
  //updateDailySnapshot(pool as IndexPool, event);
  pool.feesTotalUSD = pool.feesTotalUSD.plus(swapFeeValue)
  pool.totalSwapVolumeUSD = pool.totalSwapVolumeUSD.plus(swapValue)
  pool.totalVolumeUSD = pool.totalVolumeUSD.plus(swapValue)
  let swapID = joinHyphen([
    event.transaction.hash.toHexString(),
    event.logIndex.toHexString()
  ]);
  let swap = new Swap(swapID);
  swap.caller = event.params.caller;
  swap.tokenIn = event.params.tokenIn;
  swap.tokenOut = event.params.tokenOut;
  swap.tokenAmountIn = event.params.tokenAmountIn;
  swap.tokenAmountOut = event.params.tokenAmountOut;
  swap.pool = event.address.toHexString();
  swap.timestamp = event.block.timestamp.toI32();
  pool.save();
  swap.save();
  updateHourelySnapshot
}

export function handleJoin(event: LOG_JOIN): void {
  let tokenIn = loadUnderlyingToken(event.address, event.params.tokenIn);
  let tokenInStore = Token.load(event.params.tokenIn.toHexString());
  let tokenInDecimal = convertTokenToDecimal(event.params.tokenAmountIn, tokenInStore.decimals);
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool;
  let usdValue = tokenInDecimal.times(tokenInStore.priceUSD);

  tokenIn.balance = tokenIn.balance.plus(event.params.tokenAmountIn);
  tokenIn.save();
  pool.totalVolumeUSD = pool.totalVolumeUSD.plus(usdValue);
  pool.save();
  updateTokenPrices(pool as IndexPool);
  updateHourelySnapshot(pool, event);
  //updateDailySnapshot(pool, event);
}

export function handleExit(event: LOG_EXIT): void {
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool
  updateTokenPrices(pool as IndexPool);
  let tokenOut = loadUnderlyingToken(event.address, event.params.tokenOut);
  let tokenOutStore = Token.load(event.params.tokenOut.toHexString());
  let tokenOutDecimal = convertTokenToDecimal(event.params.tokenAmountOut, tokenOutStore.decimals);
  let usdValue = tokenOutDecimal.times(tokenOutStore.priceUSD);

  tokenOut.balance = tokenOut.balance.minus(event.params.tokenAmountOut);
  tokenOut.save();
  pool.totalVolumeUSD = pool.totalVolumeUSD.plus(usdValue);
  pool.save();
  updateHourelySnapshot(pool, event);
  //updateDailySnapshot(pool, event);
}

export function handleDenormUpdated(event: LOG_DENORM_UPDATED): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool
  let oldDenorm = token.denorm;
  let newDenorm = event.params.newDenorm;
  if (newDenorm.gt(oldDenorm)) {
    let diff = newDenorm.minus(oldDenorm);
    pool.totalWeight = pool.totalWeight.plus(diff);
  } else if (oldDenorm.gt(newDenorm)) {
    let diff = oldDenorm.minus(newDenorm);
    pool.totalWeight = pool.totalWeight.minus(diff);
  }
  pool.save();
  token.denorm = event.params.newDenorm;
  token.save();
  updateTokenPrices(pool as IndexPool);
  updateHourelySnapshot(pool as IndexPool, event);
  //updateDailySnapshot(pool as IndexPool, event);
}

export function handleDesiredDenormSet(event: LOG_DESIRED_DENORM_SET): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  token.desiredDenorm = event.params.desiredDenorm;
  token.save();
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool;
  updateTokenPrices(pool as IndexPool);
  updateHourelySnapshot(pool, event);
}

export function handleTransfer(event: Transfer): void {
  let pool = IndexPool.load(event.address.toHexString()) as IndexPool
  let isMint = event.params.src.toHexString() == ADDRESS_ZERO;
  let isBurn = event.params.dst.toHexString() == ADDRESS_ZERO;
  if (isMint) {
    //IndexPool starts with a certain supply
    pool.totalSupply = pool.totalSupply.plus(event.params.amt);
    pool.save();
  } /*else {
    let sender = loadIndexPoolBalance(event.address, event.params.src);
    sender.balance = sender.balance.minus(event.params.amt);
    sender.save();
  }*/
  if (isBurn) {
    pool.totalSupply = pool.totalSupply.minus(event.params.amt);
    pool.save();
  } /*else {
    let receiver = loadIndexPoolBalance(event.address, event.params.dst);
    receiver.balance = receiver.balance.plus(event.params.amt);
    receiver.save();
  }*/
  pool.save();
  updateTokenPrices(pool as IndexPool);
  //updateDailySnapshot(pool, event);
  updateHourelySnapshot(pool, event);
  
}

export function handlePoolTokenRemoved(event: LOG_TOKEN_REMOVED): void {
  let record = loadUnderlyingToken(event.address, event.params.token);
  record.pool = 'null';
  record.save();
  let tokensList = new Array<Bytes>();
  let pool = IndexPool.load(event.address.toHexString());
  let currentTokens = pool.tokensList;
  for (let i = 0; i < currentTokens.length; i++) {
    let token = currentTokens[i];
    if (token.toString() != event.params.token.toString()) {
      tokensList.push(token);
    }
  }
  pool.tokensList = tokensList;
  pool.save();
}

export function handlePoolTokenAdded(event: LOG_TOKEN_ADDED): void {
  let tokenID = joinHyphen([event.address.toHexString(), event.params.token.toHexString()]);
  let token = new UnderlyingTokens(tokenID as string);
  token.token = event.params.token.toHexString();
  token.ready = false;
  token.minimumBalance = event.params.minimumBalance;
  token.denorm = ZERO_BI
  token.desiredDenorm = event.params.desiredDenorm;
  token.balance = ZERO_BI
  token.pool = event.address.toHexString();
  token.save();
  let pool = IndexPool.load(event.address.toHexString());
  let currentTokens = pool.tokensList;
  currentTokens.push(event.params.token);
  pool.tokensList = currentTokens;
  pool.save();
}

export function handleTokenReady(event: LOG_TOKEN_READY): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  token.ready = true;
  token.minimumBalance = null;
  token.save();
}

export function handleUpdateMinimumBalance(event: LOG_MINIMUM_BALANCE_UPDATED): void {
  let token = loadUnderlyingToken(event.address, event.params.token);
  token.minimumBalance = event.params.minimumBalance;
  token.save();
}

export function handleMaxTokensUpdated(event: LOG_MAX_TOKENS_UPDATED): void {
  let pool = IndexPool.load(event.address.toHexString());
  pool.maxTotalSupply = event.params.maxPoolTokens;
  pool.save();
  updateTokenPrices(pool as IndexPool);
  updateHourelySnapshot(pool as IndexPool, event);
  //updateDailySnapshot( pool as IndexPool, event);
}

export function handleSwapFeeUpdated(event: LOG_SWAP_FEE_UPDATED): void {
  let pool = IndexPool.load(event.address.toHexString());
  let swapFee = hexToDecimal(event.params.swapFee.toHexString(), 18);
  pool.swapFee = swapFee;
  pool.save();
  updateTokenPrices(pool as IndexPool);
  updateHourelySnapshot(pool as IndexPool, event);
  //updateDailySnapshot( pool as IndexPool, event);
}


