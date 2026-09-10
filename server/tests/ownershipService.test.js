const {
  findOwnedGoal,
  findOwnedMilestone,
  findOwnedTask,
} = require("../services/ownershipService");

describe("ownershipService", () => {
  let db;

  beforeEach(() => {
    db = {
      query: jest.fn(),
    };
  });

  describe("findOwnedGoal", () => {
    test("returns a goal belonging to the authenticated user", async () => {
      const goal = {
        id: 5,
        user_id: 4,
        title: "Ownership Isolation Test",
      };

      db.query.mockResolvedValue({
        rows: [goal],
      });

      const result =
        await findOwnedGoal(
          db,
          5,
          4
        );

      expect(result).toEqual(goal);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "AND user_id = $2"
        ),
        [5, 4]
      );
    });

    test("returns null when the goal is unavailable to the user", async () => {
      db.query.mockResolvedValue({
        rows: [],
      });

      const result =
        await findOwnedGoal(
          db,
          5,
          2
        );

      expect(result).toBeNull();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [5, 2]
      );
    });
  });

  describe("findOwnedMilestone", () => {
    test("returns a milestone belonging to the authenticated user", async () => {
      const milestone = {
        id: 10,
        goal_id: 5,
        title: "Test Milestone",
      };

      db.query.mockResolvedValue({
        rows: [milestone],
      });

      const result =
        await findOwnedMilestone(
          db,
          10,
          4
        );

      expect(result).toEqual(
        milestone
      );

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "goals.user_id = $2"
        ),
        [10, 4]
      );
    });

    test("returns null when the milestone is unavailable to the user", async () => {
      db.query.mockResolvedValue({
        rows: [],
      });

      const result =
        await findOwnedMilestone(
          db,
          10,
          2
        );

      expect(result).toBeNull();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 2]
      );
    });
  });

  describe("findOwnedTask", () => {
    test("returns a task belonging to the authenticated user", async () => {
      const task = {
        id: 42,
        topic_id: 15,
        goal_id: 5,
        user_id: 4,
        status: "pending",
      };

      db.query.mockResolvedValue({
        rows: [task],
      });

      const result =
        await findOwnedTask(
          db,
          42,
          4
        );

      expect(result).toEqual(task);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "goals.user_id = $2"
        ),
        [42, 4]
      );
    });

    test("returns null when the task is unavailable to the user", async () => {
      db.query.mockResolvedValue({
        rows: [],
      });

      const result =
        await findOwnedTask(
          db,
          42,
          2
        );

      expect(result).toBeNull();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [42, 2]
      );
    });
  });
});
