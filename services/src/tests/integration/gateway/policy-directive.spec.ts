import { ApolloServerTestClient, createTestClient } from 'apollo-server-testing';
import { ApolloServerBase, gql } from 'apollo-server-core';
import { ApolloServer, IResolvers } from 'apollo-server-fastify';
import { when } from 'jest-when';
import { concatAST, DocumentNode } from 'graphql';
import { sdl as policySdl, PolicyDirective } from '../../../modules/directives/policy/policy';
import { sdl as stubSdl, StubDirective } from '../../../modules/directives/stub';
import { sdl as lowerCaseSdl, LowerCaseDirective } from '../utils/lower-case-directive';
import { baseTypeDef, resolvers as baseResolvers } from '../../../modules/base-schema';
import GraphQLErrorSerializer from '../../utils/graphql-error-serializer';

const mockValidatePolicy = jest.fn();
// eslint-disable-next-line unicorn/no-useless-undefined
when(mockValidatePolicy).calledWith({ namespace: 'ns', name: 'alwaysAllow' }).mockResolvedValue(undefined);
when(mockValidatePolicy).calledWith({ namespace: 'ns', name: 'alwaysDeny' }).mockRejectedValue(new Error('Error'));
jest.mock('../../../modules/directives/policy/policy-executor', () => ({
  default: jest.fn().mockImplementation(() => ({ validatePolicy: mockValidatePolicy })),
}));

interface TestCase {
  typeDefs: DocumentNode;
  resolvers?: IResolvers;
}

const testCases: [string, TestCase][] = [
  [
    'Policy on field, resolver on object (ALLOW)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @policy(namespace: "ns", name: "alwaysAllow")
        }
        type Query {
          foo: Foo!
        }
      `,
      resolvers: {
        Query: {
          foo: () => ({ bar: 'BAR' }),
        },
      },
    },
  ],
  [
    'Policy on field, resolver on object (DENY)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @policy(namespace: "ns", name: "alwaysDeny")
        }
        type Query {
          foo: Foo!
        }
      `,
      resolvers: {
        Query: {
          foo: () => ({ bar: 'BAR' }),
        },
      },
    },
  ],
  [
    'Policy on field, stub on parent query (ALLOW)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @policy(namespace: "ns", name: "alwaysAllow")
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'Policy on field, stub on parent query (DENY)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @policy(namespace: "ns", name: "alwaysDeny")
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'Stub, policy on field (ALLOW)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @stub(value: "BAR") @policy(namespace: "ns", name: "alwaysAllow")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Stub, policy on field (DENY)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @stub(value: "BAR") @policy(namespace: "ns", name: "alwaysDeny")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Policy, stub on field (ALLOW)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @policy(namespace: "ns", name: "alwaysAllow") @stub(value: "BAR")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Policy, stub on field (DENY)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @policy(namespace: "ns", name: "alwaysDeny") @stub(value: "BAR")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Policy on object, stub on field (ALLOW)',
    {
      typeDefs: gql`
        type Foo @policy(namespace: "ns", name: "alwaysAllow") {
          bar: String! @stub(value: "BAR")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Policy on object, stub on field (DENY)',
    {
      typeDefs: gql`
        type Foo @policy(namespace: "ns", name: "alwaysDeny") {
          bar: String! @stub(value: "BAR")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Policy on object, stub on parent query (ALLOW)',
    {
      typeDefs: gql`
        type Foo @policy(namespace: "ns", name: "alwaysAllow") {
          bar: String!
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'Policy, stub on parent query (DENY)',
    {
      typeDefs: gql`
        type Foo @policy(namespace: "ns", name: "alwaysDeny") {
          bar: String!
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'Stub, lowerCase, policy on field (ALLOW)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @stub(value: "BAR") @lowerCase @policy(namespace: "ns", name: "alwaysAllow")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Stub, lowerCase, policy on field (DENY)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @stub(value: "BAR") @lowerCase @policy(namespace: "ns", name: "alwaysDeny")
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Stub, policy, lowerCase on field (ALLOW)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @stub(value: "BAR") @policy(namespace: "ns", name: "alwaysAllow") @lowerCase
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'Stub, policy, lowerCase on field (DENY)',
    {
      typeDefs: gql`
        type Foo {
          bar: String! @stub(value: "BAR") @policy(namespace: "ns", name: "alwaysDeny") @lowerCase
        }
        type Query {
          foo: Foo! @stub(value: {})
        }
      `,
    },
  ],
  [
    'LowerCase on object, policy on field, stub on parent query (ALLOW)',
    {
      typeDefs: gql`
        type Foo @lowerCase {
          bar: String! @policy(namespace: "ns", name: "alwaysAllow")
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'LowerCase on object, policy on field, stub on parent query (DENY)',
    {
      typeDefs: gql`
        type Foo @lowerCase {
          bar: String! @policy(namespace: "ns", name: "alwaysDeny")
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'LowerCase, policy on object, stub on parent query (ALLOW)',
    {
      typeDefs: gql`
        type Foo @lowerCase @policy(namespace: "ns", name: "alwaysAllow") {
          bar: String!
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'LowerCase, policy on object, stub on parent query (DENY)',
    {
      typeDefs: gql`
        type Foo @lowerCase @policy(namespace: "ns", name: "alwaysDeny") {
          bar: String!
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'Policy, lowerCase on object, stub on parent query (ALLOW)',
    {
      typeDefs: gql`
        type Foo @policy(namespace: "ns", name: "alwaysAllow") @lowerCase {
          bar: String!
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
  [
    'Policy, lowerCase on object, stub on parent query (DENY)',
    {
      typeDefs: gql`
        type Foo @policy(namespace: "ns", name: "alwaysDeny") @lowerCase {
          bar: String!
        }
        type Query {
          foo: Foo! @stub(value: { bar: "BAR" })
        }
      `,
    },
  ],
];

describe.each(testCases)('Policy Directive Tests', (testName, { typeDefs, resolvers }) => {
  let client: ApolloServerTestClient;
  let server: ApolloServerBase;

  const query = gql`
    query {
      foo {
        bar
      }
    }
  `;

  beforeAll(() => {
    server = new ApolloServer({
      typeDefs: concatAST([baseTypeDef, typeDefs, stubSdl, policySdl, lowerCaseSdl]),
      resolvers: [resolvers ?? {}, baseResolvers],
      schemaDirectives: {
        stub: StubDirective,
        policy: PolicyDirective,
        lowerCase: LowerCaseDirective,
      },
    });
    client = createTestClient(server);

    expect.addSnapshotSerializer(GraphQLErrorSerializer);
  });

  test(testName, async () => {
    const response = await client.query({ query });
    expect(response).toMatchSnapshot();
  });
});