import '@interfaces/http/controllers';

import { Application, urlencoded, json } from 'express';
import { Container } from 'inversify';
import { InversifyExpressServer } from 'inversify-express-utils';
import { Redis } from 'ioredis';
import { Db } from 'mongodb';

import { AuthorReadModelFacade, IAuthorReadModelFacade } from '@application/projection/author/ReadModel';
import { BookReadModelFacade, IBookReadModelFacade } from '@application/projection/book/ReadModel';
import { CreateBookCommandHandler } from '@commandHandlers/book/CreateBookCommandHandler';
import { UpdateBookAuthorCommandHandler } from '@commandHandlers/book/UpdateBookAuthorCommandHandler';
import { CreateUserCommandHandler } from '@commandHandlers/user/CreateUserCommandHandler';
import config from '@config/main';
import { NAMES, TYPES } from '@constants/types';
import { Command } from '@core/Command';
import { ICommandHandler } from '@core/ICommandHandler';
import { IEventBus } from '@core/IEventBus';
import { IEventHandler } from '@core/IEventHandler';
import { IEventStore } from '@core/IEventStore';
import { AuthorCreated } from '@domain/book/events/AuthorCreated';
import { BookAuthorChanged } from '@domain/book/events/BookAuthorChanged';
import { BookCreated } from '@domain/book/events/BookCreated';
import { IBookRepository } from '@domain/book/IBookRepository';
import { UserCreated } from '@domain/user/events/UserCreated';
import { IUserRepository } from '@domain/user/IUserRepository';
import { AuthorCreatedEventHandler } from '@eventHandlers/author/AuthorCreatedEventHandler';
import { BookAuthorChangedEventHandler } from '@eventHandlers/book/BookAuthorChangedEventHandler';
import { BookCreatedEventHandler } from '@eventHandlers/book/BookCreatedEventHandler';
import { FakeNotificationEventHandler } from '@eventHandlers/book/FakeNotificationEventHandler';
import { UserCreatedEventHandler } from '@eventHandlers/user/UserCreatedEventHandler';
import { CommandBus } from '@infrastructure/commandBus';
import { createMongodbConnection } from '@infrastructure/db/mongodb';
import { EventBus } from '@infrastructure/eventbus';
import { EventStore } from '@infrastructure/eventstore';
import { getRedisClient } from '@infrastructure/redis';
import { BookRepository } from '@infrastructure/repositories/BookRepository';
import { UserRepository } from '@infrastructure/repositories/UserRepository';
import { errorHandler } from '@interfaces/http/middlewares/ErrorHandler';

const initialise = async () => {
  const container = new Container();

  // Module Registration
  const db: Db = await createMongodbConnection(config.MONGODB_URI);

  // Initialise Redis
  const redisSubscriber: Redis = getRedisClient();
  const redis: Redis = getRedisClient();
  await redisSubscriber.subscribe([BookCreated.name, UserCreated.name, AuthorCreated.name, BookAuthorChanged.name]);

  container.bind<Redis>(TYPES.RedisSubscriber).toConstantValue(redisSubscriber);
  container.bind<Redis>(TYPES.Redis).toConstantValue(redis);
  container.bind<IEventBus>(TYPES.EventBus).to(EventBus);

  // Read models for query
  container.bind<IBookReadModelFacade>(TYPES.BookReadModelFacade).to(BookReadModelFacade);
  container.bind<IAuthorReadModelFacade>(TYPES.AuthorReadModelFacade).to(AuthorReadModelFacade);
  // Event Handlers
  container.bind<IEventHandler<BookCreated>>(TYPES.Event).to(FakeNotificationEventHandler);
  container.bind<IEventHandler<BookAuthorChanged>>(TYPES.Event).to(BookAuthorChangedEventHandler);
  container.bind<IEventHandler<UserCreated>>(TYPES.Event).to(UserCreatedEventHandler);
  container.bind<IEventHandler<UserCreated>>(TYPES.Event).to(AuthorCreatedEventHandler);
  container.bind<IEventHandler<BookCreated>>(TYPES.Event).to(BookCreatedEventHandler);

  // Redis is also an event publisher here
  const eventBus = container.get<IEventBus>(TYPES.EventBus);
  const bookEventStore: IEventStore = new EventStore(db.collection('book-events'), eventBus);
  const userEventStore: IEventStore = new EventStore(db.collection('user-events'), eventBus);

  // Prepare persistence components
  container.bind<Db>(TYPES.Db).toConstantValue(db);
  container.bind<IEventStore>(TYPES.EventStore).toConstantValue(bookEventStore).whenTargetNamed(NAMES.BookEventStore);
  container.bind<IEventStore>(TYPES.EventStore).toConstantValue(userEventStore).whenTargetNamed(NAMES.UserEventStore);
  container.bind<IBookRepository>(TYPES.BookRepository).to(BookRepository);
  container.bind<IUserRepository>(TYPES.UserRepository).to(UserRepository);

  // Register command handlers
  container.bind<ICommandHandler<Command>>(TYPES.CommandHandler).to(CreateBookCommandHandler);
  container.bind<ICommandHandler<Command>>(TYPES.CommandHandler).to(UpdateBookAuthorCommandHandler);
  container.bind<ICommandHandler<Command>>(TYPES.CommandHandler).to(CreateUserCommandHandler);

  // Create command bus
  const commandBus = new CommandBus();
  // Register all the command handler here
  container.getAll<ICommandHandler<Command>[]>(TYPES.CommandHandler).forEach((handler: any) => {
    commandBus.registerHandler(handler.constructor.commandToHandle, handler);
  });
  container.bind<CommandBus>(TYPES.CommandBus).toConstantValue(commandBus);

  const server = new InversifyExpressServer(container);

  server.setConfig((app: Application) => {
    app.use(urlencoded({ extended: true }));
    app.use(json());
  });

  server.setErrorConfig((app: Application) => {
    app.use(errorHandler);
  });

  const apiServer = server.build();
  apiServer.listen(config.API_PORT, () =>
    console.log('The application is initialised on the port %s', config.API_PORT)
  );

  return container;
};

export { initialise };