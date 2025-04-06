import BN from "bn.js";
import { ethers } from "hardhat";
import { ContractReceipt, ContractTransaction, Signer, utils } from "ethers";
import { chainlink, ec, ecvrf } from "../../../../common_modules/chainlink-vrf";
import type { MockBlockhashStore, VRFCoordinatorV2_5, VRFCoordinatorV2_5__factory } from "../../../../typechain-types";
import type {
  RandomWordsFulfilledEvent,
  RandomWordsRequestedEvent,
} from "../../../../typechain-types/@chainlink/contracts/src/v0.8/dev/vrf/VRFCoordinatorV2_5";
import EventHelper, { checkEventMap, genEventMap } from "../../contracthelper/util/event-helper";

/**
 * @name CoordinatorConfig
 * @description value for coordinator.setConfig
 */
export interface CoordinatorConfig {
  minimumRequestConfirmations: number;
  maxGasLimit: number;
  stalenessSeconds: number;
  gasAfterPaymentCalculation: number;
  fallbackWeiPerUnitLink: bigint;
  feeConfig: {
    fulfillmentFlatFeeLinkPPM: number;
    fulfillmentFlatFeeNativePPM: number;
  };
}

const defaultConfig: CoordinatorConfig = {
  minimumRequestConfirmations: 1,
  maxGasLimit: 50_000_000,
  stalenessSeconds: 600,
  gasAfterPaymentCalculation: 10_000,
  fallbackWeiPerUnitLink: 5_486_000_000_000_000n,
  feeConfig: {
    fulfillmentFlatFeeLinkPPM: 0,
    fulfillmentFlatFeeNativePPM: 0,
  },
};

const eventMap = {
  VRFCoordinatorV2_5: ["RandomWordsFulfilled", "RandomWordsRequested"],
} as const;

interface EventMap {
  RandomWordsFulfilled: RandomWordsFulfilledEvent;
  RandomWordsRequested: RandomWordsRequestedEvent;
}

checkEventMap<EventMap, typeof eventMap>();

const w = (x: Promise<ContractTransaction>) => x.then((y) => y.wait());

/**
 * @name VRFTest
 * @description Deployment of the coordinator for unit testing of the contract using VRF.
 * @description Parsing RandomWordsRequested events and sending fulfill transactions
 */
export default class VRFTest {
  constructor(coordinatorConfig?: Partial<CoordinatorConfig>) {
    this.coordinatorConfig = {
      ...defaultConfig,
      ...coordinatorConfig,
      feeConfig: {
        ...defaultConfig.feeConfig,
        ...coordinatorConfig?.feeConfig,
      },
    };
  }

  signer!: Signer;
  coordinatorConfig: CoordinatorConfig;

  factories!: {
    VRFCoordinatorV2_5: VRFCoordinatorV2_5__factory;
  };

  staticContracts!: {
    blockhashStore: MockBlockhashStore;
  };

  contracts!: {
    coordinator: VRFCoordinatorV2_5;
  };

  eventHelper!: EventHelper<EventMap>;

  sk!: BN;
  pk!: chainlink.Point;
  keyHash!: string;

  // function to be called in the before hook
  async before(signer?: Signer) {
    signer = signer ?? (await ethers.getSigners())[0];
    this.signer = signer;
    const [VRFCoordinatorV2_5, blockhashStore] = await Promise.all([
      ethers.getContractFactory("VRFCoordinatorV2_5", signer),
      ethers.getContractFactory("MockBlockhashStore", signer).then((f) => f.deploy()),
    ]);
    this.factories = { VRFCoordinatorV2_5 };
    this.staticContracts = { blockhashStore };
    this.eventHelper = new EventHelper(genEventMap(this.factories, eventMap));
    const kp = ec.genKeyPair();
    const rawPk = kp.getPublic();
    const keyHash = chainlink.hashOfKey(rawPk);
    this.sk = kp.getPrivate();
    this.pk = [rawPk.getX().toArray("be", 32), rawPk.getY().toArray("be", 32)];
    this.keyHash = keyHash;
    await Promise.all([blockhashStore].map((c) => c.deployed()));
  }

  // function to be called in the beforeEach hook
  async beforeEach() {
    const {
      signer,
      coordinatorConfig,
      factories: { VRFCoordinatorV2_5 },
      staticContracts: { blockhashStore },
      pk,
    } = this;
    const coordinator = await VRFCoordinatorV2_5.deploy(blockhashStore.address);
    this.contracts = { coordinator };
    await Promise.all([coordinator].map((c) => c.deployed()));
    await Promise.all([
      w(
        coordinator.setConfig(
          coordinatorConfig.minimumRequestConfirmations,
          coordinatorConfig.maxGasLimit,
          coordinatorConfig.stalenessSeconds,
          coordinatorConfig.gasAfterPaymentCalculation,
          coordinatorConfig.fallbackWeiPerUnitLink,
          coordinatorConfig.feeConfig
        )
      ),
      w(coordinator.registerProvingKey(await signer.getAddress(), pk)),
    ]);
  }

  // function to be called when RandomWordsRequested event is emitted
  // send fulfill transaction after handling event
  // check validation of RandomWordsRequested, RandomWordsFulfilled events optionally
  async randomWordsRequested(event: RandomWordsRequestedEvent, validate = false) {
    const {
      sk,
      contracts: { coordinator },
    } = this;
    const {
      blockHash,
      args: { keyHash },
    } = event;
    const preSeed = event.args.preSeed.toBigInt();
    const requestId = event.args.requestId.toBigInt();
    if (validate) {
      const calculated = BigInt(utils.solidityKeccak256(["bytes32", "uint256"], [keyHash, preSeed]));
      if (requestId !== calculated) throw new Error(`invalid requestId: should be ${calculated} but ${requestId}`);
    }
    const rc = {
      blockNum: event.blockNumber,
      subId: event.args.subId.toBigInt(),
      callbackGasLimit: BigInt(event.args.callbackGasLimit),
      numWords: BigInt(event.args.numWords),
      sender: event.args.sender,
      extraArgs: event.args.extraArgs,
    };
    const proof = await chainlink.prove(sk, preSeed, blockHash);
    const ret = coordinator.fulfillRandomWords(proof, rc);
    if (validate) {
      const r = await (await ret).wait();
      const event = this.findFulfillEvent(r);
      if (!event) throw new Error("RandomWordsFulfilled not emitted");
      {
        const retrieved = event.args.requestId.toBigInt();
        if (retrieved !== requestId)
          throw new Error(`invalid requestId: requested ${requestId} but ${retrieved} fulfilled`);
      }
      {
        const retrieved = event.args.outputSeed.toBigInt();
        const calculated = BigInt(
          await ecvrf.compute({
            gamma: ec.curve.point(proof.gamma[0], proof.gamma[1]),
          })
        );
        if (retrieved !== calculated) throw new Error(`invalid outputSeed: should be ${calculated} but ${retrieved}`);
      }
    }
    return ret;
  }

  // handling RandomWordsRequested events
  async eventsEmitted(receipt: ContractReceipt, validate = false) {
    return Promise.all(this.filterRequestEvent(receipt).map((event) => this.randomWordsRequested(event, validate)));
  }

  filterRequestEvent(receipt: ContractReceipt) {
    return this.eventHelper.filterAndParse(
      "RandomWordsRequested",
      (receipt.events ?? []).filter((x) => x.address === this.contracts.coordinator.address)
    );
  }

  findFulfillEvent(receipt: ContractReceipt) {
    const events = receipt.events;
    if (!events || events.length === 0) return null;
    const event = events[events.length - 1];
    if (event.address !== this.contracts.coordinator.address) return null;
    return this.eventHelper.maybeParse("RandomWordsFulfilled", event);
  }

  async doSingleFulfill(requestReceipt: ContractReceipt, validate = false) {
    const fulfills = await this.eventsEmitted(requestReceipt, validate);
    if (fulfills.length !== 1) throw new Error(`number of fulfillment (${fulfills.length}) is not 1`);
    return fulfills[0];
  }

  async singleFulfill(requestReceipt: ContractReceipt, validate = false) {
    const fulfillReceipt = await w(this.doSingleFulfill(requestReceipt, validate));
    const fulfillEvent = this.findFulfillEvent(fulfillReceipt);
    if (!fulfillEvent) throw new Error("fulfill event is null");
    return fulfillEvent;
  }
}
