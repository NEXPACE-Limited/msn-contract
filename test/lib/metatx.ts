import { ethers, PopulatedTransaction, Signer } from "ethers";

export function changeSender(sender: string, tx: PopulatedTransaction): PopulatedTransaction {
  return {
    ...tx,
    from: undefined,
    data: ethers.utils.solidityPack(["bytes", "address"], [tx.data, sender]),
  };
}

export async function sendMetaTransaction(relayer: Signer, sender: string, tx: PopulatedTransaction) {
  return relayer.sendTransaction(changeSender(sender, tx));
}
