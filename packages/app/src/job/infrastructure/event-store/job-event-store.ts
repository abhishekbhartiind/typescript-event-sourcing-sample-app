import { inject, injectable } from 'inversify';
import { Db } from 'mongodb';

import { BASE_TYPES } from '@common/types';
import { IEventBus } from '@cqrs-es/core';
import { IEventStore } from '@cqrs-es/core';
import { EventStore } from '@src/common/infrastructure/eventstore';

@injectable()
export class JobEventStore extends EventStore implements IEventStore {
  constructor(
    @inject(BASE_TYPES.Db) private readonly db: Db,
    @inject(BASE_TYPES.EventBus) private readonly eventBus: IEventBus
  ) {
    super(db.collection('job-events'), eventBus);
  }
}
