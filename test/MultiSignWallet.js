const {expect} = require("chai");
const {ethers} = require("hardhat");



const chai = require("chai");
chai.use(require("chai-events"));

describe("MultiSignWallet Test", ()=>{

  let multiSign;
  let accounts;
  let owner1;
  let owner2;
  let owner3;
  let nonOwner;
  const numConfirmationsRequired = 2;
  let depositAmount = ethers.utils.parseEther("1");
  let txIndex = 0;

  before(async function() {
    // Get contract reference
    const wallet = await ethers.getContractFactory("MultiSignWallet"); 
    // Get accounts (Signers)
    accounts = await ethers.getSigners(); 
    owner1 = accounts[0].address;
    owner2 = accounts[1].address;
    owner3 = accounts[2].address;
    nonOwner = accounts[3].address;
    // Deploy contract and hold his reference
    multiSign = await wallet.deploy(
      [owner1, owner2, owner3],
      numConfirmationsRequired
    ); 
    // Waiting contract to be fully deployed
    await multiSign.deployed(); 
  });

  describe("constructor", () => {
    it("should initialize the contract with a valid array of owners and a valid number of confirmations required", async () => {
      expect(await multiSign.isOwner(owner1)).to.be.true;
      expect(await multiSign.isOwner(owner2)).to.be.true;
      expect(await multiSign.isOwner(owner3)).to.be.true;
      expect(await multiSign.numConfirmationsRequired()).to.equal(numConfirmationsRequired);
    });
  });
  describe("confirmTransaction", () => {

    it("should correctly confirm a transaction and update the state variables", async () => {
      await multiSign.submitTransaction(owner1, 0, "0x");
      await multiSign.confirmTransaction(0);
      expect(await multiSign.isConfirmed(0, owner1)).to.be.true;
    });

     it("should only allow unconfirmed transactions to be confirmed", async () => {
       await multiSign.submitTransaction(owner1, 0, "0x");
     
        try {
          const res = await multiSign.confirmTransaction(0);
          console.log(res);
        } catch (error) {
          console.log(error.message);
          expect(error.message).to.includes('tx already confirmed');
        }
    
    });

    it("should throw an error if the transaction does not exist", async () => {
      // Ensure the specified transaction index does not exist
      const nonExistentTransactionIndex = 999;
      await expect(multiSign.confirmTransaction(nonExistentTransactionIndex))
        .to.be.revertedWith("transaction does not exist");
    });
    
  });

  describe("submitTransaction", () => {
    it("should correctly submit a transaction and emit the correct event", async () => {
      
     await multiSign.submitTransaction(owner1, 0, "0x");
     const tx =  await multiSign.transactions(0);
    
      expect(tx.to).to.equal(owner1);
      expect(tx.value).to.equal(0);
      expect(tx.data).to.equal("0x");
      expect(tx.executed).to.be.false;
      expect(tx.numConfirmations).to.equal(1);
    });

    it("should only allow owners to submit transactions", async () => {
      expect(await multiSign.isOwner(nonOwner)).to.be.false;
      expect(multiSign.submitTransaction(nonOwner, 0, "0x")).to.be.revertedWith("Not the owner");
    });
  });

  describe("DepositETH", () => {
    it("should correctly deposit ether and update the contract balance", async () => {
      const initialBalance = await ethers.provider.getBalance(multiSign.address);
      const transaction = await multiSign.DepositETH({ value: depositAmount });
      expect(await ethers.provider.getBalance(multiSign.address)).to.equal(initialBalance.add(depositAmount));
    });

    it("should throw an error if a value of 0 is sent", async () => {
      await expect(multiSign.DepositETH({ value: 0 })).to.be.revertedWith("Value must be greater than 0");
    });
  });
  describe("revokeConfirmation", () => {
    it("should correctly revoke a confirmation and update the contract state", async () => {

       const account2 = await multiSign.connect(accounts[1]);
       account2.confirmTransaction(0);
       const [, , , , numConfirmations_before] = await account2.transactions(
        0
      );
     //console.log(numConfirmations_before+"...");
      const tx = await account2.revokeConfirmation(0);
      const [, , , , numConfirmations_after] = await multiSign.transactions(
        0
      );
      //console.log(numConfirmations_after);
     expect(numConfirmations_after).to.equal(numConfirmations_before.sub(1));
    });

    it("should only allow owners to revoke confirmations", async () => {
      await multiSign.submitTransaction(owner1, 0, "0x");
      const account3 = await multiSign.connect(accounts[3]);
      account3.confirmTransaction(0);
      const [, , , , numConfirmations_before] = await account3.transactions(
        0
      );
      console.log(numConfirmations_before+"...");
      try {
        const res = await account3.revokeConfirmation(0);
        console.log(res);
      } catch (error) {
        console.log(error.message);
        const [, , , , numConfirmations_before] = await account3.transactions(
          0
        );
        console.log(numConfirmations_before+"...");
        expect(error.message).to.includes('Not the owner');
      }
    });

  });
  describe("executeTransaction", () => {
    it("should correctly execute a transaction and update the contract state", async () => {

       const account1 = await multiSign.connect(accounts[0]);
       account1.confirmTransaction(0);
       const account2 = await multiSign.connect(accounts[1]);
       account2.confirmTransaction(0);
     
       await account2.executeTransaction(0);
       const expectedResult = [  owner1,  0,  '0x',  true,  2];
       expect(await account2.transactions(0)).to.deep.equal(expectedResult);

    });
    it("should only allow transactions with enough confirmations to be executed", async () => {
      await multiSign.submitTransaction(owner1, 1, "0x");
      await multiSign.confirmTransaction(1);
      await expect(multiSign.executeTransaction(1)).to.be.revertedWith("Can't execute tx not enough confirmations");
    });
    
  });
  

})