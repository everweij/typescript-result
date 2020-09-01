import { Result } from "..";

const ERROR = new Error("Something went wrong");

const wait = (value?: any) =>
  new Promise(resolve => setTimeout(() => resolve(value), 10));

describe("Result", () => {
  describe("Creation", () => {
    describe("Result.ok()", () => {
      it("wraps a valid value", () => {
        const result = Result.ok<Error, number>(123);

        expect(result.isSuccess()).toBe(true);
        expect(result.isFailure()).toBe(false);
        expect((result as any).value).toBe(123);
      });
    });

    describe("Result.error()", () => {
      it("wraps a error message", () => {
        const result = Result.error(ERROR);

        expect(result.isFailure()).toBe(true);
        expect(result.isSuccess()).toBe(false);
        expect((result as any).value).toBe(undefined);
        expect((result as any).error).toBe(ERROR);
      });
    });

    describe("Result.safe()", () => {
      it("replaces a traditional try-catch block", () => {
        const result = Result.safe(() => 123);

        expect((result as any).value).toBe(123);
      });

      it("replaces a traditional try-catch block ASYNC", async () => {
        const result = await Result.safe(async () => 123);

        expect((result as any).value).toBe(123);
      });

      it("catches an error and returns it as a Result.Error", () => {
        const error = new Error("Random error");

        const result = Result.safe(() => {
          throw error;
          // @ts-ignore
          return 123;
        });

        expect((result as any).error).toBe(error);
      });

      it("allows you to pass in a pre-defined error", () => {
        const result = Result.safe(ERROR, () => 123);

        expect((result as any).value).toBe(123);
      });
      it("allows you to pass in a pre-defined error ASYNC", async () => {
        const result = await Result.safe(ERROR, async () => 123);

        expect(result.isSuccess()).toBe(true);
        expect((result as any).value).toBe(123);
      });

      it("returns an Result.Error when the callbacks throws", () => {
        const result = Result.safe(ERROR, () => {
          throw new Error("This should fail");
          // @ts-ignore
          return 1;
        });

        expect(result.isFailure()).toBe(true);
        expect((result as any).error).toBe(ERROR);
      });

      it("returns an Result.Error when the callbacks throws", async () => {
        const result = await Result.safe(ERROR, async () => {
          throw new Error("This should fail");
          // @ts-ignore
          return 1;
        });

        expect(result.isFailure()).toBe(true);
        expect((result as any).error).toBe(ERROR);
      });
    });

    describe("Result.wrap()", () => {
      it("wraps a function and returns a function that returns a Result", () => {
        const wrappedOk = Result.wrap(function test(name: string) {
          return `Ok ${name}!`;
        });

        const resultOk = wrappedOk("Erik");

        expect(resultOk.isSuccess()).toBe(true);
        expect((resultOk as any).value).toBe("Ok Erik!");

        const wrappedError = Result.wrap(function test(name: string) {
          if (name === "Erik") {
            throw ERROR;
          }
          return `Ok ${name}!`;
        });

        const resultError = wrappedError("Erik");

        expect(resultError.isFailure()).toBe(true);
        expect((resultError as any).error).toBe(ERROR);
      });

      it("wraps a function and returns a function that returns a Result ASYNC", async () => {
        const wrappedOk = Result.wrap(async function test(name: string) {
          return `Ok ${name}!`;
        });

        const resultOk = await wrappedOk("Erik");

        expect(resultOk.isSuccess()).toBe(true);
        expect((resultOk as any).value).toBe("Ok Erik!");

        const wrappedError = Result.wrap(async function test(name: string) {
          if (name === "Erik") {
            throw ERROR;
          }
          return `Ok ${name}!`;
        });

        const resultError = await wrappedError("Erik");

        expect(resultError.isFailure()).toBe(true);
        expect((resultError as any).error).toBe(ERROR);
      });
    });

    describe("Result.combine()", () => {
      it("combines multiple Results into into one Result, and returns a tuple of ok values on success", () => {
        const result1 = Result.ok<Error, number>(1);
        const result2 = Result.ok<Error, number>(2);
        const result3 = Result.ok<Error, number>(3);

        const result = Result.combine(result1, result2, result3);

        expect((result as any).value).toEqual([1, 2, 3]);
      });

      it("combines multiple Results into into one Result, and returns the first error on failure", () => {
        const result1 = Result.ok<Error, number>(1);
        const result2 = Result.ok<Error, number>(2);
        const result3 = Result.error<Error, number>(ERROR);

        const result = Result.combine(result1, result2, result3);

        expect(result.isFailure()).toBe(true);
        expect((result as any).error).toBe(ERROR);
      });

      it("enables you to recover and rollback changes on failure", () => {
        const originalData = {
          a: 1,
          b: 2,
          c: 3,
        };

        const data = { ...originalData };

        function incrementValue(
          key: keyof typeof data
        ): Result<Error, number, () => void> {
          const oldValue = data[key];

          if (key === "c") {
            return Result.error(ERROR);
          }

          return Result.ok(data[key]++, () => (data[key] = oldValue));
        }

        const resultCombined = Result.combine(
          () => incrementValue("a"),
          () => incrementValue("b"),
          () => incrementValue("c")
        );

        if (resultCombined.isFailure()) {
          resultCombined.rollback();
        }

        expect(data).toEqual(originalData);
      });

      it("enables you to recover and rollback changes on failure ASYNC", async () => {
        const originalData = {
          a: 1,
          b: 2,
          c: 3,
        };

        const data = { ...originalData };

        async function incrementValue(
          key: keyof typeof data
        ): Promise<Result<Error, number, () => void>> {
          await wait();

          const oldValue = data[key];

          if (key === "c") {
            return Result.error(ERROR);
          }

          return Result.ok(data[key]++, () => (data[key] = oldValue));
        }

        const resultCombined = await Result.combine(
          () => incrementValue("a"),
          () => incrementValue("b"),
          () => incrementValue("c")
        );

        if (resultCombined.isFailure()) {
          resultCombined.rollback();
        }

        expect(data).toEqual(originalData);
      });

      it("lets you know whether a rollback succeeded or not", async () => {
        const ROLLBACK_ERROR = new Error("Rollback error");

        function someFn(
          value: string,
          throwInRollback: boolean = false
        ): Result<Error, number, () => void> {
          if (value === "throw") {
            return Result.error(ERROR);
          }

          return Result.ok(111, () => {
            if (throwInRollback) {
              throw ROLLBACK_ERROR;
            }
          });
        }

        async function someAsyncFn(
          value: string,
          throwInRollback: boolean = false
        ): Promise<Result<Error, number, () => Promise<void>>> {
          if (value === "throw") {
            return Result.error(ERROR);
          }

          return Result.ok(111, async () => {
            if (throwInRollback) {
              throw ROLLBACK_ERROR;
            }
          });
        }

        const syncResultOk = Result.combine(
          () => someFn("aaa"),
          () => someFn("aaa"),
          () => someFn("aaa")
        );
        expect(syncResultOk.isSuccess()).toBe(true);

        const syncResultErrorAndSuccessfulRollback = Result.combine(
          () => someFn("aaa"),
          () => someFn("aaa"),
          () => someFn("throw")
        );
        expect(syncResultErrorAndSuccessfulRollback.isFailure()).toBe(true);
        expect(
          syncResultErrorAndSuccessfulRollback.rollback().isSuccess()
        ).toBe(true);

        const syncResultErrorAndFailingRollback = Result.combine(
          () => someFn("aaa"),
          () => someFn("aaa", true),
          () => someFn("throw")
        );
        expect(syncResultErrorAndFailingRollback.isFailure()).toBe(true);
        expect(syncResultErrorAndFailingRollback.rollback().isFailure()).toBe(
          true
        );

        const asyncResultOk = await Result.combine(
          () => someAsyncFn("aaa"),
          () => someAsyncFn("aaa"),
          () => someAsyncFn("aaa")
        );
        expect(asyncResultOk.isSuccess()).toBe(true);

        const asyncResultErrorAndSuccessfulRollback = await Result.combine(
          () => someAsyncFn("aaa"),
          () => someAsyncFn("aaa"),
          () => someAsyncFn("throw")
        );
        expect(asyncResultErrorAndSuccessfulRollback.isFailure()).toBe(true);
        expect(
          (await asyncResultErrorAndSuccessfulRollback.rollback()).isSuccess()
        ).toBe(true);

        const asyncResultErrorAndFailingRollback = await Result.combine(
          () => someAsyncFn("aaa"),
          () => someAsyncFn("aaa", true),
          () => someAsyncFn("throw")
        );
        expect(asyncResultErrorAndFailingRollback.isFailure()).toBe(true);
        expect(
          (await asyncResultErrorAndFailingRollback.rollback()).isFailure()
        ).toBe(true);
      });
    });
  });

  describe("Methods", () => {
    describe("Result#errorOrNull()", () => {
      it("returns the error on failure, null on success", () => {
        const resultError = Result.error(ERROR);
        expect(resultError.errorOrNull()).toBe(ERROR);

        const resultOk = Result.ok(1);
        expect(resultOk.errorOrNull()).toBe(null);
      });
    });

    describe("Result#toString()", () => {
      it("outputs a neat string representation of the result", () => {
        const resultError = Result.error(ERROR);
        expect(resultError.toString()).toBe(
          "Result.Error(Error: Something went wrong)"
        );

        const resultOk = Result.ok(1);
        expect(resultOk.toString()).toBe("Result.Ok(1)");
      });
    });

    describe("Result#fold()", () => {
      it("returns the value or error based on success or failure", () => {
        const resultOk = Result.ok(1);
        let value = resultOk.fold(
          value => value,
          () => 2
        );
        expect(value).toBe(1);

        const resultError = Result.error<Error, number>(ERROR);
        value = resultError.fold(
          value => value,
          () => 2
        );
        expect(value).toBe(2);
      });

      it("returns the value or error based on success or failure ASYNC", async () => {
        const resultOk = Result.ok(1);
        let value = await resultOk.fold(
          async value => value,
          async () => 2
        );
        expect(value).toBe(1);

        const resultError = Result.error<Error, number>(ERROR);
        value = await resultError.fold(
          async value => value,
          async () => 2
        );
        expect(value).toBe(2);
      });
    });

    describe("Result#getOrDefault()", () => {
      it("returns the value or success, or a default value on failure", () => {
        const resultOk = Result.ok(1);
        let value = resultOk.getOrDefault(2);
        expect(value).toBe(1);

        const resultError = Result.error<Error, number>(ERROR);
        value = resultError.getOrDefault(2);
        expect(value).toBe(2);
      });
    });

    describe("Result#getOrElse()", () => {
      it("returns the value or success, or the return value of a callback on failure", () => {
        const resultOk = Result.ok(1);
        let value = resultOk.getOrElse(() => 2);
        expect(value).toBe(1);

        const resultError = Result.error<Error, number>(ERROR);
        value = resultError.getOrElse(error => {
          expect(error).toBe(ERROR);
          return 2;
        });
        expect(value).toBe(2);
      });

      it("returns the value or success, or the return value of a callback on failure ASYNC", async () => {
        const resultOk = Result.ok(1);
        let value = await resultOk.getOrElse(async () => 2);
        expect(value).toBe(1);

        const resultError = Result.error<Error, number>(ERROR);
        value = await resultError.getOrElse(async error => {
          expect(error).toBe(ERROR);
          return 2;
        });
        expect(value).toBe(2);
      });
    });

    describe("Result#getOrThrow()", () => {
      it("returns the value or success, or throws on failure", () => {
        const resultOk = Result.ok(1);
        let value = resultOk.getOrThrow();
        expect(value).toBe(1);

        const resultError = Result.error<Error, number>(ERROR);

        expect(() => resultError.getOrThrow()).toThrow();
      });
    });

    describe("Result#map()", () => {
      it("maps the value to another Result on success, returns Result.Error on failure", () => {
        const resultOk = Result.ok<Error, number>(1).map(val =>
          Result.ok(val * 2)
        );
        expect((resultOk as any).value).toBe(2);

        const resultError = Result.error<Error, number>(ERROR).map(val =>
          Result.ok(val * 2)
        );
        expect((resultError as any).error).toBe(ERROR);
      });

      it("maps the value to another Result on success, returns Result.Error on failure ASYNC", async () => {
        const resultOk = await Result.ok<Error, number>(1).map(async val =>
          Result.ok(val * 2)
        );
        expect((resultOk as any).value).toBe(2);

        const resultError = await Result.error<Error, number>(
          ERROR
        ).map(async val => Result.ok(val * 2));
        expect((resultError as any).error).toBe(ERROR);
      });
    });

    describe("Result#forward", () => {
      it("forwards a error or value into a new Result", () => {
        const error = Result.error(ERROR);
        expect(error.forward().errorOrNull()).toBe(ERROR);

        const success = Result.ok("success");
        expect(success.forward().getOrNull()).toBe("success");
      });
    });
  });
});
