const jestMock = require('jest-mock');
const prisma = {
  product: {
    findMany: jestMock.fn()
  }
};

prisma.product.findMany.mockResolvedValue([]);

const txMock = {
  ...prisma
};

prisma.product.findMany.mockResolvedValue([{ id: 1 }]);

txMock.product.findMany().then(console.log);
