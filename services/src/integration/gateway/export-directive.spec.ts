import {createTestClient, ApolloServerTestClient} from 'apollo-server-testing';
import {gql} from 'apollo-server-core';
import {print} from 'graphql';
import * as nock from 'nock';
import {createApolloServer} from '../../gateway';
import {mockResourceBucketReads} from '../resourceBucket';
import {beforeEachDispose} from '../beforeEachDispose';

const organizations = [
    {
        name: 'EvilCorp',
        teams: [
            {
                name: 'Evil Team',
                employees: [{name: 'Aviv'}],
            },

            {
                name: 'Really Evil Team',
                employees: [{name: 'Alex'}],
            },
        ],
    },
    {
        name: 'GoodCorp',
        teams: [
            {
                name: 'Good Team',
                employees: [{name: 'Michael'}],
            },

            {
                name: 'Really Good Team',
                employees: [{name: 'Eleanor'}],
            },
        ],
    },
];

const schema = {
    metadata: {
        namespace: 'namespace',
        name: 'name',
    },
    schema: print(gql`
        type Employee {
            name: String!
            organizationName: ID! @stub(value: "{exports.organizationName}")
        }

        type Team {
            name: String!
            employees: [Employee!]!
        }

        type Organization {
            name: String! @export(key: "organizationName")
            teams: [Team!]!
        }

        type Query {
            organizations: [Organization!]! @rest(url: "http://test.api/organizations")
        }
    `),
};

const resourceGroup = {
    etag: 'etag',
    schemas: [schema],
    upstreams: [],
    upstreamClientCredentials: [],
};

describe('Export Directive', () => {
    let client: ApolloServerTestClient;

    beforeEachDispose(() => {
        mockRestBackend('http://test.api');
        mockResourceBucketReads(resourceGroup);

        const stitch = createApolloServer();
        client = createTestClient(stitch.server);

        return () => {
            nock.cleanAll();
            return stitch.dispose();
        };
    });

    it('Resolvers have access to exports from grandparent level', async () => {
        const response = await client.query({
            query: gql`
                query {
                    organizations {
                        teams {
                            employees {
                                name
                                organizationName
                            }
                        }
                    }
                }
            `,
        });

        expect(response.errors).toBeUndefined();
        const orgNames = response.data!.organizations.flatMap((org: any) =>
            org.teams.flatMap((team: any) => team.employees.map((emp: any) => emp.organizationName))
        );
        expect(orgNames).toEqual(['EvilCorp', 'EvilCorp', 'GoodCorp', 'GoodCorp']);
    });
});

function mockRestBackend(host: string) {
    return nock(host)
        .get('/organizations')
        .reply(200, organizations);
}