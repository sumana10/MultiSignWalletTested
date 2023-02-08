//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultiSignWallet{

    event Deposit(address indexed sender,uint amount,uint balance);

    event SubmitTransaction(
        address indexed owner,
        uint indexed txIndex,
        address indexed to,
        uint value,
        bytes data
    );

    event ConfirmTransaction(address indexed owner,uint indexed txIndex);

    event RevokeTransaction(address indexed owner,uint indexed txIndex);

    event ExecuteTransaction(address indexed owner,uint indexed txIndex);

    address[] public owners;
    mapping(address=>bool) public isOwner;
    uint public numConfirmationsRequired;

    struct Transaction{
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    mapping(uint=>mapping(address=>bool)) public isConfirmed;

    Transaction[] public transactions;

    modifier onlyOwner(){
        require(isOwner[msg.sender],"Not the owner");
        _;
    }

    modifier txExists(uint _txIndex){
        require(_txIndex<transactions.length,"transaction does not exist");
        _;
    }

    modifier notExecuted(uint _txIndex){
        require(!transactions[_txIndex].executed,"tx already excuted");
        _;
    }
    
    modifier notConfirmed(uint _txIndex){
        require(!isConfirmed[_txIndex][msg.sender],"tx already confirmed");
        _;
    }

    constructor(address[] memory _owners,uint _numConfirmationsRequired){
        require(_owners.length>0,"at least one owner required");
        require(_numConfirmationsRequired>0 && _numConfirmationsRequired<=_owners.length,
        "invalid number of required confirmations in constructor");
        for(uint i=0;i<_owners.length;i++){
            address owner=_owners[i];
            require(owner!=address(0),"Invalid owner");
            require(!isOwner[owner],"owner not unique");
            isOwner[owner]=true;
            owners.push(owner);
        }
        numConfirmationsRequired=_numConfirmationsRequired;
    }


    function confirmTransaction(uint _txIndex)public onlyOwner 
    txExists(_txIndex) 
    notExecuted(_txIndex)
    notConfirmed(_txIndex){
        Transaction storage transaction= transactions[_txIndex];
        transaction.numConfirmations+=1;
        isConfirmed[_txIndex][msg.sender]=true;
        // numConfirmationsRequired+=1;
        emit ConfirmTransaction(msg.sender,_txIndex);
    }

    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data
    ) public onlyOwner{
        uint txIndex=transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value:_value,
                data:_data,
                executed:false,
                numConfirmations:0
            })
        );
        emit SubmitTransaction(msg.sender,txIndex,_to,_value,_data);
    }

    function DepositETH() public payable{
        require(msg.value > 0, "Value must be greater than 0");
        (bool success,)=address(this).call{value:msg.value}("");
        require(success,"invalid or failure");
        emit Deposit(msg.sender,msg.value,address(this).balance);
    } 

    receive() external payable{}


       function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        
        Transaction storage transaction = transactions[_txIndex];
        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "Can't execute tx not enough confirmations"
        );
        transaction.executed = true;
        (bool success, ) = transaction.to.call{gas:20000,value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");
        
        emit ExecuteTransaction(msg.sender, _txIndex);
    }


    function revokeConfirmation(uint _txIndex)
    public
    onlyOwner
    txExists(_txIndex)
    notExecuted(_txIndex)
    {
        Transaction storage transaction =transactions[_txIndex];
        require (isConfirmed[_txIndex][msg.sender],"tx is not confirmed");
        transaction.numConfirmations-=1;
        isConfirmed[_txIndex][msg.sender]=false;

        emit RevokeTransaction(msg.sender,_txIndex);

    }

    function getOwners() public view returns(address[] memory){
        return owners;
    }

    function getTransactionCount() public view returns(uint){
        return transactions.length;
    }

    function getTransaction(uint _txIndex)
    public 
    view
    returns(
        address to,
        uint value,
        bytes memory data,
        bool executed,
        uint numConfirmations
    )
    {
        Transaction storage transaction=transactions[_txIndex];
        return(
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }

     function getBalance() public view returns(uint){

        return address(this).balance;

    }
    

}
