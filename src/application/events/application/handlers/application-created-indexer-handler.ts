import { injectable } from 'inversify';

import { IEventHandler } from '@core/IEventHandler';
import { ApplicationCreated } from '@domain/application/events/application-created';

@injectable()
export class ApplicationCreatedEsIndexerEventHandler implements IEventHandler<ApplicationCreated> {
  event = ApplicationCreated.name;

  async handle(event: ApplicationCreated) {
    console.log(event, 'INDEXER');
  }
}
