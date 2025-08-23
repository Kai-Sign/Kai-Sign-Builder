const { request, gql } = require('graphql-request');

const endpoint = 'https://gateway.thegraph.com/api/subgraphs/id/F3XjWNiNFUTbZhNQjXuhP7oDug2NaPwMPZ5XCRx46h5U';

const query = `{
  questions(where: {user: "0x8d82439Fa83153f024e7D3f21fdaf5d4662939B5"}) 
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
