const gymnameModel = require("../Models/gymName");
const mongoose = require("mongoose");

class TrieNode {
  constructor(ch) {
    this.data = ch;
    this.children = new Array(26).fill(null); // Array to store 26 children (a-z)
    this.isLast = false; // Marks if this node represents the last character of a word
  }
}

// Function to insert a word into the Trie
function insertWord(root, word) {
  if (word.length === 0) {
    root.isLast = true;
    return;
  }

  let ch = word[0];
  let index = ch.charCodeAt(0) - "a".charCodeAt(0);
  let child;

  if (root?.children[index] !== null) {
    child = root.children[index];
  } else {
    child = new TrieNode(ch);
    root.children[index] = child;
  }

  insertWord(child, word.substring(1));
}

let strings = [];
// Function to collect all words from a given Trie node
function getall(root, str) {
  if (root.isLast === true) {
    strings.push(str);
  }

  for (let i = 0; i < 26; i++) {
    if (root.children[i] !== null) {
      let result = String.fromCharCode("a".charCodeAt(0) + i);
      getall(root.children[i], str + result);
    }
  }
}

// Function to find words based on user's typed input
function allWords(root, character, allwords) {
  // Insert all words from the database into the Trie
  for (let i = 0; i < allwords.length; i++) {
    insertWord(root, allwords[i]);
  }

  let str = "";
  let l = 0;

  // Traverse the Trie based on user's input character(s)
  while (l < character.length) {
    let index = character[l].charCodeAt(0) - "a".charCodeAt(0);
    if (root.children[index] !== null) {
      let result = String.fromCharCode("a".charCodeAt(0) + index);
      str += result;
      root = root.children[index];
    } else {
      return "empty";
    }
    l++;
  }

  // Once the prefix is found, collect all matching words
  getall(root, str);
  return strings;
}

// const root = new TrieNode('.');
// const allwords = ["coding", "code", "coder", "codehelp", "codechef"];  // Example word list
// let strings = [];  // Array to store recommended words

// // Simulating user input and generating recommendations
// const userInput = "cfding";  // Example input from user

// const recommendations = allWords(root, userInput, allwords);
// console.log("Recommendations:", recommendations);

// Function to fetch all gym names from the database
async function getGymNames() {
  try {
    // Fetch all gym names from MongoDB
    const gyms = await gymnameModel.find({});
    // Flatten the gym names into a single array
    return gyms.map((gym) => gym.name).flat();
  } catch (err) {
    console.error(err);
    return []; // Return an empty array in case of an error
  }
}

// Main Code to Insert and Get Recommendations
const main = async () => {
  mongoose
    .connect(
      "mongodb+srv://ayushgym:ayushgymapp@cluster0.c2fwa.mongodb.net/gym"
    )
    .then(() => console.log("MonogDB connected Successfully"))
    .catch((err) => console.log("err :", err));

  const root = new TrieNode(".");

  // Fetch all gym names and initialize the Trie
  const allwords = "baj";
  console.log("Gym Names:", allwords);

  // Simulate user input and generate recommendations
  const userInput = "e"; // Example input from user

  const recommendations = allWords(root, userInput, allwords);
  console.log("Recommendations:", recommendations);

  // Close MongoDB connection
  mongoose.connection.close();
};

main();
