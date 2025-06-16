import express from "express"
import bodyParser from "body-parser"
import pg from "pg"
import axios from "axios"

//connecting with database
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "booknotes",
  password: "1028715",
  port: 5432
})

db.connect();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"))


//extracting books from database
async function getBooks() {
  const response = await db.query("select * from book");
  return response.rows;
}
//extracting books in order of alphabetical order of title
async function getTitleBooks() {
  const response = await db.query("select * from book order by title asc");
  return response.rows;
}
//extracting books in order of latest reading
async function getLatestBooks() {
  const response = await db.query("select * from book  order by dateread desc");
  return response.rows;
}
//extracting books in order of best rating
async function getBestBooks() {
  const response = await db.query("select * from book  order by rating desc");
  return response.rows;
}
//bool variable to hide the main content and to display only searchedbook
var hide = false;
var searchBook = null;
//deciding which order to display
var order = 1;
app.get("/", async (req, res) => {
  let books = null;
  if (order == 1) {
    books = await getBooks();
  }
  else if (order == 2) {
    books = await getTitleBooks();
  }
  else if (order == 3) {
    books = await getLatestBooks();
  }
  else {
    books = await getBestBooks();
  }
  order = 1;
  await Promise.all(
    books.map(async (i) => {
      //formatting dates
      i.dateread = i.dateread.toISOString().split("T")[0];
      //getting images from open library
      try {
        const response = await axios.get("https://openlibrary.org/search.json?title=" + encodeURIComponent(i.title));
        if (response.data.docs && response.data.docs.length > 0) {
          i.image = response.data.docs[0].cover_edition_key;
        } else {
          i.image = null;
        }
      } catch (err) {
        console.log("Error loading image of " + i.title);
        i.image = null;
      }
    })
  );
  console.log(searchBook)
  //rendering main page with all varaibles
  res.render("home.ejs", { books: books, hide: hide, search: searchBook });
  hide = false;
  searchBook = null;
});

//this is triggered when user searches any book
app.post("/search", async (req, res) => {
  const response = await db.query("select * from book where lower(title)=$1", [req.body.searchBook.toLowerCase()]);
  searchBook = response.rows[0];
  //if search is valid then following is executed
  if (searchBook) {
    hide = true;
    searchBook.dateread = searchBook.dateread.toISOString().split('T')[0];
    try {
      const response = await axios.get("https://openlibrary.org/search.json?title=" + encodeURIComponent(searchBook.title));
      if (response.data.docs && response.data.docs.length > 0) {
        searchBook.image = response.data.docs[0].cover_edition_key;
        console.log(searchBook.image);
      } else {
        searchBook.image = null;
      }
    } catch (err) {
      console.log("Error loading image of " + searchBook.title);
      searchBook.image = null;
    }
  }
  //redirecting to main page
  res.redirect("/")
})

//this is triggered when user wants to sort.
app.post("/sort", (req, res) => {
  if (req.body.sort == "title") {
    order = 2;
  }
  else if (req.body.sort == "latest") {
    order = 3;
  }
  else if (req.body.sort == "best") {
    order = 4;
  }
    //redirecting to main page
  res.redirect("/");
})

//when user want to read notes of book this get is used.
app.get("/book/:title", async (req, res) => {
  //taking which title user selected
  const pr = req.params.title;
  const response = await db.query("select * from book where lower(title)=$1", [pr.toLowerCase()]);
  const searchBook1 = response.rows[0];
  if (searchBook1) {
    searchBook1.dateread = searchBook1.dateread.toISOString().split('T')[0];
    try {
      const response = await axios.get("https://openlibrary.org/search.json?title=" + encodeURIComponent(searchBook1.title));
      if (response.data.docs && response.data.docs.length > 0) {
        searchBook1.image = response.data.docs[0].cover_edition_key;
        console.log(searchBook1.image);
      } else {
        searchBook1.image = null;
      }
    } catch (err) {
      console.log("Error loading image of " + searchBook1.title);
      searchBook1.image = null;
    }
    res.render("notes.ejs", { item: searchBook1 });
  }
  else{
      //redirecting to main page in case no search is matched
    res.redirect("/")
  }

})

//triggered when user wants to edit.
app.post("/edit", async (req, res) => {
  if (req.body.book) {
    res.render("edit.ejs", { book: JSON.parse(req.body.book) })
  }
})

//triggered when user clicks update button
app.post("/update", async (req, res) => {
  const response = await db.query("update book set rating=$1, dateread=$2, summary=$3, notes=$4 where bookid=$5", [req.body.rating, req.body.dateread, req.body.summary, req.body.notes, req.body.id]);
  res.redirect("/");
})

//triggered when user clicks delete button

app.post("/delete", async (req, res) => {
  const response = await db.query("delete from book where bookid=$1", [req.body.bookid]);
  res.redirect("/");
})

app.listen("3000", () => {
  console.log("starting port 3000")
})