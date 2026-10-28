export const PREDICTIVE_SEARCH_PRODUCTS_QUERY = `
  query PredictiveSearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          status
          publishedAt
          tags
          totalInventory
          featuredImage {
            url
            altText
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          options {
            name
            values
          }
          collections(first: 3) {
            edges {
              node {
                title
                handle
              }
            }
          }
          metafields(first: 10) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
          variants(first: 5) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                availableForSale
                inventoryQuantity
                image { url }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const SEARCH_PRODUCTS_QUERY = `
  query SearchProducts($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          status
          publishedAt
          tags
          totalInventory
          featuredImage {
            url
            altText
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          options {
            name
            values
          }
          collections(first: 5) {
            edges {
              node {
                title
                handle
              }
            }
          }
          metafields(first: 25) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                availableForSale
                inventoryQuantity
                image { url }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

/** Slim availability probe — one nodes() call verifies purchasability for
 *  the finalists so index-snapshot inventory can't headline an OOS item. */
export const AVAILABILITY_BY_IDS_QUERY = `
  query AvailabilityByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        totalInventory
        variants(first: 30) {
          edges {
            node {
              availableForSale
            }
          }
        }
      }
    }
  }
`;

export const GET_PRODUCT_DETAILS_QUERY = `
  query GetProductDetails($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      vendor
      productType
      tags
      totalInventory
      descriptionHtml
      description
      featuredImage {
        url
        altText
      }
      images(first: 6) {
        edges {
          node {
            url
            altText
          }
        }
      }
      priceRangeV2 {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      options {
        id
        name
        values
      }
      variants(first: 20) {
        edges {
          node {
            id
            title
            sku
            price
            compareAtPrice
            availableForSale
            inventoryQuantity
            image { url }
            selectedOptions {
              name
              value
            }
            image {
              url
              altText
            }
          }
        }
      }
      metafields(first: 30) {
        edges {
          node {
            namespace
            key
            value
            type
          }
        }
      }
    }
  }
`;

export const GET_PRODUCTS_BY_IDS_QUERY = `
  query GetProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        handle
        vendor
        productType
        tags
        totalInventory
        descriptionHtml
        description
        featuredImage {
          url
          altText
        }
        priceRangeV2 {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        options {
          name
          values
        }
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
              compareAtPrice
              availableForSale
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
        metafields(first: 20) {
          edges {
            node {
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  }
`;
