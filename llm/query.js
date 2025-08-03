const { request, gql } = require('graphql-request');

const endpoint = 'https://gateway.thegraph.com/api/subgraphs/id/F3XjWNiNFUTbZhNQjXuhP7oDug2NaPwMPZ5XCRx46h5U';

const query = `{
  questions(where: {user: "0xB55D4406916e20dF5B965E15dd3ff85fa8B11dCf"}) 
  {
    data
  }
} `;

const headers = {
  Authorization: 'Bearer be5ddfca879e5ea553aa90060c35999a',
};

async function fetchData() {
  try {
    const data = await request(endpoint, query, {}, headers);
    console.log(data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();
