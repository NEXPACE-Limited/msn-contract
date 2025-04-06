import { expect } from "chai";
import BN from "bn.js";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber, ContractTransaction } from "ethers";
import { chainlink, ec } from "../../common_modules/chainlink-vrf";
import {
  RandomSeedGeneratedEvent,
  RandomSeedGenerator,
  RandomSeedRequestedEvent,
  RandomSeedRevealedEvent,
} from "../../typechain-types/contracts/Random/RandomSeedGenerator";
import { SubscriptionCreatedEvent } from "../../typechain-types/@chainlink/contracts/src/v0.8/dev/vrf/SubscriptionAPI";
import EventHelper, { checkEventMap, genEventMap } from "../lib/contracthelper/util/event-helper";
import VRFTest from "../lib/testenv/vrf";
import nxErrors from "../lib/nx-errors";

const w = (x: Promise<ContractTransaction>) => x.then((y) => y.wait());

const eventMap = {
  RandomSeedGenerator: ["RandomSeedRequested", "RandomSeedGenerated", "RandomSeedRevealed"],
  VRFCoordinatorV2_5: ["SubscriptionCreated"],
} as const;

interface EventMap {
  RandomSeedRequested: RandomSeedRequestedEvent;
  RandomSeedGenerated: RandomSeedGeneratedEvent;
  RandomSeedRevealed: RandomSeedRevealedEvent;
  SubscriptionCreated: SubscriptionCreatedEvent;
}

checkEventMap<EventMap, typeof eventMap>();

async function proveRandomSeed(sk: BN, event: RandomSeedGeneratedEvent) {
  const proof = await chainlink.proveDirect(sk, new BN(event.args.inputSeed.toHexString().substring(2), "hex"));
  const secretSeed = await chainlink.outputHashFromProof(proof);
  return {
    proof,
    secretSeed,
  };
}

describe("RandomSeedGenerator", function () {
  async function fixture() {
    const [admin, oracle, alice, bob] = await ethers.getSigners();

    const maxVRFPendingTime = BigNumber.from(300);

    const oracleVrfTest = new VRFTest();
    await oracleVrfTest.before(oracle);
    await oracleVrfTest.beforeEach();

    const kp = ec.genKeyPair();
    const rawPk = kp.getPublic();
    const keyHash = chainlink.hashOfKey(rawPk);
    const sk = kp.getPrivate();

    const VRFManagerChainlink = await ethers.getContractFactory("VRFManagerChainlink", admin);
    const vrfManagerChainlink = await VRFManagerChainlink.deploy(oracleVrfTest.contracts.coordinator.address);

    const RandomSeedGenerator = await ethers.getContractFactory("RandomSeedGenerator", admin);

    const eventHelper = new EventHelper<EventMap>(
      genEventMap(
        {
          RandomSeedGenerator,
          VRFCoordinatorV2_5: await ethers.getContractFactory("VRFCoordinatorV2_5"),
        },
        eventMap
      )
    );

    const rsg = await RandomSeedGenerator.deploy(
      ethers.constants.AddressZero,
      vrfManagerChainlink.address,
      keyHash,
      1n
    );

    await vrfManagerChainlink.setConfig(oracleVrfTest.keyHash, 1n, 100000);
    await vrfManagerChainlink.addVRFRequester(rsg.address, maxVRFPendingTime);
    await alice.sendTransaction({
      to: vrfManagerChainlink.address,
      value: ethers.utils.parseEther("100"),
    });

    const res = eventHelper.findAndParse(
      "SubscriptionCreated",
      ((await w(vrfManagerChainlink.subscribe())).events ?? [])!
    );
    if (!res) throw new Error("SubscriptionCreated not emitted");
    const subId = res.args.subId;

    return {
      admin,
      oracle,
      alice,
      bob,
      maxVRFPendingTime,
      oracleVrfTest,
      sk,
      RandomSeedGenerator,
      rsg,
      vrfManagerChainlink,
      eventHelper,
      keyHash,
      subId,
    };
  }

  before(async function () {
    this.timeout(10000);
    await loadFixture(fixture);
  });

  describe("check variable", function () {
    it("keyHash", async function () {
      const { rsg, keyHash } = await loadFixture(fixture);
      expect(await rsg.keyHash()).to.equal(keyHash);
    });
  });

  describe("integrated", function () {
    it("happy path", async function () {
      const { sk, rsg, oracleVrfTest, eventHelper } = await loadFixture(fixture);

      const nextReceipt = await w(rsg.next());

      const fulfillTxs = await oracleVrfTest.eventsEmitted(nextReceipt);
      expect(fulfillTxs, "fulfill txs").to.have.lengthOf(1);

      const fulfillReceipt = await fulfillTxs[0].wait();

      expect(
        oracleVrfTest.eventHelper.findAndParse("RandomWordsFulfilled", fulfillReceipt.events ?? [])!.args.success,
        "success"
      ).to.be.true;

      const genEvent = eventHelper.findAndParse("RandomSeedGenerated", fulfillReceipt.events ?? []);
      expect(genEvent, "RandomSeedGenerated event").to.be.ok;
      expect(genEvent!.args.sequence.toBigInt(), "RandomSeedGenerated sequence").to.be.eq(0n);

      const { proof, secretSeed } = await proveRandomSeed(sk, genEvent!);

      const revealReceipt = await w(rsg.reveal(proof));

      const revealEvent = eventHelper.findAndParse("RandomSeedRevealed", revealReceipt.events ?? []);
      expect(revealEvent, "RandomSeedRevealed event").to.be.ok;
      expect(revealEvent!.args.sequence.toBigInt(), "RandomSeedRevealed sequence").to.be.eq(0n);
      expect(revealEvent!.args.secretSeed.toBigInt(), "RandomSeedRevealed sequence").to.be.eq(BigInt(secretSeed));
    });

    it("multiple times", async function () {
      const { sk, rsg, oracleVrfTest, eventHelper } = await loadFixture(fixture);

      for (let i = 0; i < 4; i++) {
        const nextReceipt = await w(rsg.next());
        const fulfillTxs = await oracleVrfTest.eventsEmitted(nextReceipt);
        const fulfillReceipt = await fulfillTxs[0].wait();
        const genEvent = eventHelper.findAndParse("RandomSeedGenerated", fulfillReceipt.events ?? []);
        const { proof, secretSeed } = await proveRandomSeed(sk, genEvent!);
        expect((await rsg.verifyAndComputeSeed(i, proof)).toBigInt(), "RandomSeedRevealTest").to.eq(BigInt(secretSeed));
        const revealReceipt = await w(rsg.reveal(proof));

        const revealEvent = eventHelper.findAndParse("RandomSeedRevealed", revealReceipt.events ?? []);

        expect(revealEvent, `RandomSeedRevealed event ${i}`).to.be.ok;
        expect(revealEvent!.args.sequence.toBigInt(), `RandomSeedRevealed sequence ${i}`).to.be.eq(BigInt(i));
        expect(revealEvent!.args.secretSeed.toBigInt(), `RandomSeedRevealed secretSeed ${i}`).to.be.eq(
          BigInt(secretSeed)
        );
      }
    });

    it("expired request", async function () {
      const { rsg, oracleVrfTest, maxVRFPendingTime, eventHelper } = await loadFixture(fixture);
      const nextReceipt = await w(rsg.next());
      await time.increase(maxVRFPendingTime.add(1));
      const fulfillTxs = await oracleVrfTest.eventsEmitted(nextReceipt);
      const fulfillTx = await fulfillTxs[0].wait();
      expect(eventHelper.findAndParse("RandomSeedGenerated", fulfillTx.events!)).to.be.equal(null);
    });

    it("onlyVRFManager", async function () {
      const { rsg } = await loadFixture(fixture);
      await w(rsg.next());
      await rsg.pendingRequest();
      await expect(rsg.fulfillVRF(1, [1])).to.be.reverted;
    });

    it("invalid request", async function () {
      const { admin, rsg } = await loadFixture(fixture);
      await w(rsg.next());
      await rsg.pendingRequest();
      await rsg.pause();
      await rsg.changeVRFManager(admin.address);
      await rsg.unpause();
      await expect(rsg.fulfillVRF(1, [1])).to.be.reverted;
    });
  });

  describe("constructor", function () {
    it("should be reverted when maxDepth is zero", async function () {
      const { keyHash, vrfManagerChainlink } = await loadFixture(fixture);

      const RandomSeedGenerator = await ethers.getContractFactory("RandomSeedGenerator");
      await expect(
        RandomSeedGenerator.deploy(ethers.constants.AddressZero, vrfManagerChainlink.address, keyHash, 0)
      ).to.be.revertedWith(nxErrors.RandomSeedGenerator.invalidMaxDepth);
    });
  });

  describe("next", function () {
    it("success", async function () {
      const { rsg, oracleVrfTest } = await loadFixture(fixture);
      const nextReceipt = await w(rsg.next());
      await oracleVrfTest.eventsEmitted(nextReceipt);
    });

    it("should be reverted when not called by the owner", async function () {
      const { rsg, alice } = await loadFixture(fixture);
      await expect(rsg.connect(alice).next()).to.be.revertedWith(nxErrors.executorForbidden);
    });

    it("should be reverted when previous request has not been fulfilled", async function () {
      const { rsg } = await loadFixture(fixture);
      await rsg.next();
      await expect(rsg.next(), "second next()").to.be.revertedWith(
        nxErrors.RandomSeedGenerator.randomNumberNotFulfilled
      );
    });

    it("should be reverted when there are too many unrevealed seeds", async function () {
      const { rsg, oracleVrfTest } = await loadFixture(fixture);
      const r1 = await w(rsg.next());
      await oracleVrfTest.eventsEmitted(r1);
      await expect(rsg.next(), "second next()").to.be.revertedWith(nxErrors.RandomSeedGenerator.pendingRequests);
    });
  });

  describe("reveal", function () {
    async function fixtureForReveal() {
      const res = await loadFixture(fixture);
      const { rsg, oracleVrfTest, eventHelper } = res;

      const nextReceipt = await w(rsg.next());
      const fulfillTxs = await oracleVrfTest.eventsEmitted(nextReceipt);
      const fulfillReceipt = await fulfillTxs[0].wait();
      const genEvent = eventHelper.findAndParse("RandomSeedGenerated", fulfillReceipt.events ?? []);

      if (!genEvent) throw new Error("RandomSeedGenerated not emitted");

      return { ...res, genEvent };
    }

    it("should be reverted when no seed is unrevealed", async function () {
      const { rsg, sk, eventHelper } = await loadFixture(fixture);

      const block = await ethers.provider.getBlock("latest");
      const eventData = rsg.interface.encodeEventLog("RandomSeedGenerated", [0n, 153n]);
      const genEvent = eventHelper.parse("RandomSeedGenerated", {
        getBlock: null!, // explicit never
        getTransaction: null!,
        getTransactionReceipt: null!,
        removeListener: null!,
        blockNumber: block.number,
        blockHash: block.hash,
        transactionIndex: 0,
        removed: false,
        address: rsg.address,
        transactionHash: "0x" + "00".repeat(20),
        logIndex: 0,
        ...eventData,
      });
      const { proof } = await proveRandomSeed(sk, genEvent);

      await expect(rsg.reveal(proof)).to.be.revertedWith(nxErrors.RandomSeedGenerator.noInputSeed);
      await expect(rsg.verifyAndComputeSeed(0, proof), "RandomSeedRevealTest").to.be.revertedWith(
        nxErrors.RandomSeedGenerator.noInputSeed
      );
    });

    it("should not be reverted when a correct proof provided", async function () {
      const { rsg, sk, genEvent } = await loadFixture(fixtureForReveal);

      const { proof } = await proveRandomSeed(sk, genEvent);

      await expect(rsg.reveal(proof)).not.to.be.reverted;
      await expect(rsg.verifyAndComputeSeed(0, proof), "RandomSeedRevealTest").not.to.be.reverted;
    });

    it("should be reverted when proved with a wrong key", async function () {
      const { rsg, genEvent } = await loadFixture(fixtureForReveal);

      const sk = ec.genKeyPair().getPrivate();

      const { proof } = await proveRandomSeed(sk, genEvent);

      await expect(rsg.reveal(proof)).to.be.revertedWith(nxErrors.RandomSeedGenerator.wrongProvingKey);
      await expect(rsg.verifyAndComputeSeed(0, proof), "RandomSeedRevealTest").to.be.revertedWith(
        nxErrors.RandomSeedGenerator.wrongProvingKey
      );
    });
  });

  describe("setter", function () {
    describe("setKeyhash", function () {
      async function fixtureForSetKeyHash() {
        const res = await loadFixture(fixture);

        const newKeyHash = chainlink.hashOfKey(ec.genKeyPair().getPublic());

        return { ...res, newKeyHash };
      }

      it("success", async function () {
        const { rsg, newKeyHash } = await loadFixture(fixtureForSetKeyHash);

        await expect(rsg.setKeyHash(newKeyHash)).not.to.be.reverted;
        expect(await rsg.keyHash()).to.be.equal(newKeyHash);
      });

      it("should be reverted when not called by the owner", async function () {
        const { rsg, alice, newKeyHash } = await loadFixture(fixtureForSetKeyHash);

        await expect(rsg.connect(alice).setKeyHash(newKeyHash)).to.be.revertedWith(nxErrors.ownerForbidden);
      });
    });

    describe("changeVRFManager", function () {
      it("should be reverted when contract is not paused", async function () {
        const { rsg, alice } = await loadFixture(fixture);
        await expect(rsg.changeVRFManager(alice.address)).to.be.reverted;
      });

      it("should be reverted when not called by the owner", async function () {
        const { rsg, alice } = await loadFixture(fixture);
        await rsg.pause();
        await expect(rsg.connect(alice).changeVRFManager(alice.address)).to.be.reverted;
      });

      it("should be reverted when new VRFManager is zero address", async function () {
        const { rsg } = await loadFixture(fixture);
        await rsg.pause();
        await expect(rsg.changeVRFManager(ethers.constants.AddressZero)).to.be.reverted;
      });
    });
  });

  describe("view functions", function () {
    it("sequences", async function () {
      function showSequences(x: ReturnType<RandomSeedGenerator["sequences"]>) {
        return x.then((x) => ({
          nextRequest: x.nextRequest.toBigInt(),
          nextReveal: x.nextReveal.toBigInt(),
          maxDepth: x.maxDepth.toBigInt(),
        }));
      }

      const { sk, rsg, oracleVrfTest, eventHelper } = await loadFixture(fixture);

      for (let i = 0; i < 3; i++) {
        const r1 = await w(rsg.next());
        expect(await showSequences(rsg.sequences()), `state after request ${i}`).to.include({
          nextRequest: BigInt(i),
          nextReveal: BigInt(i),
          maxDepth: 1n,
        });

        const fulfillTxs = await oracleVrfTest.eventsEmitted(r1);
        expect(await showSequences(rsg.sequences()), `state after fulfill ${i}`).to.include({
          nextRequest: BigInt(i) + 1n,
          nextReveal: BigInt(i),
          maxDepth: 1n,
        });

        const r2 = await fulfillTxs[0].wait();
        const e1 = eventHelper.findAndParse("RandomSeedGenerated", r2.events ?? []);
        const { proof } = await proveRandomSeed(sk, e1!);

        await w(rsg.reveal(proof));
        expect(await showSequences(rsg.sequences()), `state after reveal ${i}`).to.include({
          nextRequest: BigInt(i) + 1n,
          nextReveal: BigInt(i) + 1n,
          maxDepth: 1n,
        });
      }
    });

    it("pendingRequest", async function () {
      function showPendingRequest(x: ReturnType<RandomSeedGenerator["pendingRequest"]>) {
        return x.then((x) => ({
          lastRequestId: x.toBigInt(),
        }));
      }

      const { sk, rsg, oracleVrfTest, eventHelper } = await loadFixture(fixture);

      for (let i = 0; i < 3; i++) {
        const r1 = await w(rsg.next());
        const e1 = eventHelper.findAndParse("RandomSeedRequested", r1.events!);
        expect(await showPendingRequest(rsg.pendingRequest()), `state after request ${i}`).to.include({
          lastRequestId: e1!.args.requestId.toBigInt(),
        });

        const r2 = await (await oracleVrfTest.eventsEmitted(r1))[0].wait();
        const e2 = eventHelper.findAndParse("RandomSeedGenerated", r2.events ?? []);
        const { proof } = await proveRandomSeed(sk, e2!);

        await w(rsg.reveal(proof));
      }
    });

    it("inputSeedAt, secretSeedAt, secretSeedOf, verifyAndComputeSeed", async function () {
      const { sk, rsg, oracleVrfTest, eventHelper } = await loadFixture(fixture);

      for (let i = 0; i < 3; i++) {
        const r1 = await w(rsg.next());

        await expect(rsg.inputSeedAt(BigInt(i)), `inputSeedAt after request ${i}`).to.be.revertedWith(
          nxErrors.RandomSeedGenerator.inputSeedNotReady
        );
        await expect(rsg.secretSeedAt(BigInt(i)), `secretSeedAt after request ${i}`).to.be.revertedWith(
          nxErrors.RandomSeedGenerator.inputSeedNotReady
        );

        const fulfillTxs = await oracleVrfTest.eventsEmitted(r1);

        const r2 = await fulfillTxs[0].wait();
        const e1 = eventHelper.findAndParse("RandomSeedGenerated", r2.events ?? []);

        const inputSeed = e1!.args.inputSeed.toBigInt();

        expect((await rsg.inputSeedAt(BigInt(i))).toBigInt(), `inputSeedAt after fulfill ${i}`).to.eq(inputSeed);
        await expect(rsg.secretSeedOf(inputSeed), `secretSeedOf after fulfill ${i}`).to.be.revertedWith(
          nxErrors.RandomSeedGenerator.secretSeedNotReady
        );
        await expect(rsg.secretSeedAt(BigInt(i)), `secretSeedAt after fulfill ${i}`).to.be.revertedWith(
          nxErrors.RandomSeedGenerator.secretSeedNotReady
        );

        const { proof, secretSeed } = await proveRandomSeed(sk, e1!);
        const secretSeedBigInt = BigInt(secretSeed);

        expect((await rsg.verifyAndComputeSeed(i, proof)).toBigInt(), "RandomSeedRevealTest before reveal").to.eq(
          BigInt(secretSeed)
        );
        await w(rsg.reveal(proof));
        expect((await rsg.verifyAndComputeSeed(i, proof)).toBigInt(), "RandomSeedRevealTest after reveal").to.eq(
          BigInt(secretSeed)
        );

        expect((await rsg.secretSeedOf(inputSeed)).toBigInt(), `secretSeedOf after reveal ${i}`).to.eq(
          secretSeedBigInt
        );
        expect((await rsg.secretSeedAt(BigInt(i))).toBigInt(), `secretSeedAt after reveal ${i}`).to.eq(
          secretSeedBigInt
        );
      }
    });
  });
});
