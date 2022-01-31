import { inject, injectable, named } from 'inversify';

import { NAMES, TYPES } from '@constants/types';
import { IEventStore } from '@core/IEventStore';
import { ILoanRepository } from '@domain/loan/ILoanRepository';
import { Loan } from '@domain/loan/Loan';

import { Repository } from './Repository';

@injectable()
export class LoanRepository extends Repository<Loan> implements ILoanRepository {
  constructor(@inject(TYPES.EventStore) @named(NAMES.LoanEventStore) private readonly eventstore: IEventStore) {
    super(eventstore, Loan);
  }
}